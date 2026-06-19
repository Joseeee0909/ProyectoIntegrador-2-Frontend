import { useEffect, useRef, useCallback, useState } from "react";
import { initSocket } from "../services/socket";

interface UseWebRTCOptions {
  roomId: string;
  accessToken: string;
}

interface PeerState {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  pendingCandidates: RTCIceCandidateInit[];
}

export function useWebRTC({ roomId, accessToken }: UseWebRTCOptions) {
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Update remote streams state (triggers re-render)
  const updateRemoteStreams = useCallback(() => {
    const streams = new Map<string, MediaStream>();
    peersRef.current.forEach((peer, socketId) => {
      if (peer.stream) {
        streams.set(socketId, peer.stream);
      }
    });
    setRemoteStreams(new Map(streams));
  }, []);

  // Create a new peer connection for a specific remote socket
  const createPeer = useCallback((remoteSocketId: string): PeerState => {
    // Close existing peer for this socket if any
    const existing = peersRef.current.get(remoteSocketId);
    if (existing) {
      try { existing.pc.close(); } catch { /* ignore */ }
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const sock = initSocket(accessToken);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sock.emit("webrtc:ice-candidate", { roomId, candidate, to: remoteSocketId });
      }
    };

    pc.ontrack = ({ streams }) => {
      console.log(`[WebRTC] Track received from ${remoteSocketId}`);
      const peer = peersRef.current.get(remoteSocketId);
      if (peer && streams[0]) {
        peer.stream = streams[0];
        updateRemoteStreams();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] ${remoteSocketId} connection: ${pc.connectionState}`);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peersRef.current.delete(remoteSocketId);
        updateRemoteStreams();
      }
    };

    const peerState: PeerState = { pc, stream: null, pendingCandidates: [] };
    peersRef.current.set(remoteSocketId, peerState);
    return peerState;
  }, [roomId, accessToken, updateRemoteStreams]);

  // Flush buffered ICE candidates for a peer
  const flushCandidates = useCallback(async (remoteSocketId: string) => {
    const peer = peersRef.current.get(remoteSocketId);
    if (!peer || !peer.pc.remoteDescription) return;

    const candidates = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const candidate of candidates) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Buffered candidate error:", err);
      }
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    // Detener los tracks de pantalla
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Re-adquirir la cámara
    let camStream: MediaStream;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      setIsScreenSharing(false);
      return;
    }

    const newCamTrack = camStream.getVideoTracks()[0];

    // Reemplazar en todos los peers
    for (const { pc } of peersRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newCamTrack);
    }

    // Actualizar el stream local
    if (localStreamRef.current) {
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newCamTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }

    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    screenStreamRef.current = screenStream;
    const screenTrack = screenStream.getVideoTracks()[0];

    // Reemplazar el video track en todos los peers activos
    for (const { pc } of peersRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);
    }

    // Actualizar el stream local para que el preview también cambie
    if (localStreamRef.current) {
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(screenTrack);
    }

    setIsScreenSharing(true);
    setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);

    // Restaurar cámara automáticamente si el usuario cierra el picker del SO
    screenTrack.addEventListener("ended", () => {
      void stopScreenShare();
    }, { once: true });
  }, [stopScreenShare]);

  // Get or create local stream
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  // Start call — only gets local media, connections happen via signaling
  const startCall = useCallback(async (): Promise<MediaStream> => {
    const stream = await getLocalStream();
    return stream;
  }, [getLocalStream]);

  const endCall = useCallback(() => {
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Close all peer connections
    peersRef.current.forEach((peer) => {
      try { peer.pc.close(); } catch { /* ignore */ }
    });
    peersRef.current.clear();
    setRemoteStreams(new Map());
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const sock = initSocket(accessToken);

    // When a new user joins, send them an offer
    const onUserJoined = async ({ socketId: remoteId }: { socketId: string }) => {
      if (!localStreamRef.current || !localStreamRef.current.active) return;
      console.log(`[WebRTC] User joined: ${remoteId}, sending offer`);

      try {
        const localStr = localStreamRef.current;
        const peer = createPeer(remoteId);
        localStr.getTracks().forEach((track) => peer.pc.addTrack(track, localStr));

        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        sock.emit("webrtc:offer", { roomId, offer, to: remoteId });
      } catch (err) {
        console.error("[WebRTC] Error sending offer:", err);
      }
    };

    // When we receive an offer
    const onOffer = async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
      console.log(`[WebRTC] Offer from: ${from}`);

      try {
        const localStr = await getLocalStream();
        const peer = createPeer(from);
        localStr.getTracks().forEach((track) => peer.pc.addTrack(track, localStr));

        await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushCandidates(from);

        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        sock.emit("webrtc:answer", { roomId, answer, to: from });
      } catch (err) {
        console.error("[WebRTC] Error answering:", err);
      }
    };

    // When we receive an answer
    const onAnswer = async ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
      console.log(`[WebRTC] Answer from: ${from}`);
      const peer = peersRef.current.get(from);
      if (!peer) return;

      try {
        if (peer.pc.signalingState === "have-local-offer") {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushCandidates(from);
        }
      } catch (err) {
        console.error("[WebRTC] Error setting answer:", err);
      }
    };

    // ICE candidates
    const onIceCandidate = async ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
      const peer = peersRef.current.get(from);
      if (!peer) {
        // No peer yet, might arrive later — buffer it anyway
        return;
      }

      if (!peer.pc.remoteDescription) {
        peer.pendingCandidates.push(candidate);
        return;
      }

      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] ICE error:", err);
      }
    };

    // When a user leaves, clean up their peer
    const onUserLeft = ({ socketId }: { socketId: string }) => {
      const peer = peersRef.current.get(socketId);
      if (peer) {
        try { peer.pc.close(); } catch { /* ignore */ }
        peersRef.current.delete(socketId);
        updateRemoteStreams();
      }
    };

    sock.on("user-joined", onUserJoined);
    sock.on("webrtc:offer", onOffer);
    sock.on("webrtc:answer", onAnswer);
    sock.on("webrtc:ice-candidate", onIceCandidate);
    sock.on("user-left", onUserLeft);

    return () => {
      sock.off("user-joined", onUserJoined);
      sock.off("webrtc:offer", onOffer);
      sock.off("webrtc:answer", onAnswer);
      sock.off("webrtc:ice-candidate", onIceCandidate);
      sock.off("user-left", onUserLeft);
    };
  }, [roomId, accessToken, createPeer, getLocalStream, flushCandidates, updateRemoteStreams]);

  return { startCall, endCall, localStream, localStreamRef, remoteStreams, startScreenShare, stopScreenShare, isScreenSharing };
}
