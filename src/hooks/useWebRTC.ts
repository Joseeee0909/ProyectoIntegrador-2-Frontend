import { useEffect, useRef, useCallback } from "react";
import { initSocket } from "../services/socket";

interface UseWebRTCOptions {
  roomId: string;
  accessToken: string;
  onRemoteStream?: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
}

export function useWebRTC({ roomId, accessToken, onRemoteStream, onLocalStream }: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isNegotiatingRef = useRef(false);

  // Store callbacks in refs so they don't cause effect re-runs
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onLocalStreamRef = useRef(onLocalStream);
  onRemoteStreamRef.current = onRemoteStream;
  onLocalStreamRef.current = onLocalStream;

  const createPC = useCallback(() => {
    // Close existing connection if any
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_e) { /* ignore */ }
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        initSocket(accessToken).emit("webrtc:ice-candidate", { roomId, candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      console.log("[WebRTC] Remote track received");
      if (streams[0]) {
        onRemoteStreamRef.current?.(streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state:", pc.iceConnectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [roomId, accessToken]);

  // Flush buffered ICE candidates once remote description is set
  const flushCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;

    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Failed to add buffered candidate:", err);
      }
    }
  }, []);

  // Get or reuse local media stream
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const startCall = useCallback(async (): Promise<MediaStream> => {
    const localStream = await getLocalStream();
    onLocalStreamRef.current?.(localStream);
    return localStream;
  }, [getLocalStream]);

  const endCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    try { pcRef.current?.close(); } catch (_e) { /* ignore */ }
    pcRef.current = null;
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    isNegotiatingRef.current = false;
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const sock = initSocket(accessToken);

    // When a new user joins, the existing user sends an offer
    const onUserJoined = async () => {
      if (!localStreamRef.current || !localStreamRef.current.active) return;
      if (isNegotiatingRef.current) return; // prevent duplicate offers

      console.log("[WebRTC] New user joined, sending offer...");
      isNegotiatingRef.current = true;

      try {
        const localStream = localStreamRef.current;
        const pc = createPC();
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sock.emit("webrtc:offer", { roomId, offer });
        console.log("[WebRTC] Offer sent");
      } catch (err) {
        console.error("[WebRTC] Error sending offer:", err);
        isNegotiatingRef.current = false;
      }
    };

    // When we receive an offer, answer it
    const onOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      console.log("[WebRTC] Received offer");
      isNegotiatingRef.current = true;

      try {
        const localStream = await getLocalStream();
        onLocalStreamRef.current?.(localStream);

        const pc = createPC();
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush any ICE candidates that arrived before remote description was set
        await flushCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sock.emit("webrtc:answer", { roomId, answer });
        console.log("[WebRTC] Answer sent");
      } catch (err) {
        console.error("[WebRTC] Error answering offer:", err);
        isNegotiatingRef.current = false;
      }
    };

    // When we receive an answer
    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log("[WebRTC] Received answer");
      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Flush any buffered ICE candidates
          await flushCandidates();
        }
      } catch (err) {
        console.error("[WebRTC] Error setting answer:", err);
      }
    };

    // Buffer or apply ICE candidates
    const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;

      if (!pc || !pc.remoteDescription) {
        // Buffer the candidate until remote description is set
        pendingCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] ICE candidate error:", err);
      }
    };

    sock.on("user-joined", onUserJoined);
    sock.on("webrtc:offer", onOffer);
    sock.on("webrtc:answer", onAnswer);
    sock.on("webrtc:ice-candidate", onIceCandidate);

    return () => {
      sock.off("user-joined", onUserJoined);
      sock.off("webrtc:offer", onOffer);
      sock.off("webrtc:answer", onAnswer);
      sock.off("webrtc:ice-candidate", onIceCandidate);
    };
  }, [roomId, accessToken, createPC, getLocalStream, flushCandidates]);

  return { startCall, endCall, localStreamRef };
}
