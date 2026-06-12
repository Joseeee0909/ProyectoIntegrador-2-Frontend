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

  // Store callbacks in refs so they don't cause effect re-runs
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onLocalStreamRef = useRef(onLocalStream);
  onRemoteStreamRef.current = onRemoteStream;
  onLocalStreamRef.current = onLocalStream;

  const createPC = useCallback(() => {
    // Close existing connection if any
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        initSocket(accessToken).emit("webrtc:ice-candidate", { roomId, candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      if (streams[0]) {
        onRemoteStreamRef.current?.(streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("[WebRTC] Connection state:", state);
      if (state === "failed") {
        console.warn("[WebRTC] Connection failed, closing peer connection");
        pc.close();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [roomId, accessToken]);

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

    // Don't create offer immediately — wait for another user to join
    // The offer will be triggered by "user-joined" event
    return localStream;
  }, [getLocalStream]);

  // Create and send offer to a specific peer (triggered when a new user joins)
  const sendOffer = useCallback(async () => {
    const localStream = await getLocalStream();
    const pc = createPC();
    const sock = initSocket(accessToken);

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sock.emit("webrtc:offer", { roomId, offer });
    console.log("[WebRTC] Offer sent to room:", roomId);
  }, [roomId, accessToken, createPC, getLocalStream]);

  const endCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const sock = initSocket(accessToken);

    // When a new user joins the room, send them an offer
    const onUserJoined = ({ socketId }: { socketId: string }) => {
      console.log("[WebRTC] User joined, sending offer to:", socketId);
      // Only send offer if we have a local stream (i.e., call is active)
      if (localStreamRef.current && localStreamRef.current.active) {
        void sendOffer();
      }
    };

    // When we receive an offer, create answer
    const onOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      console.log("[WebRTC] Received offer, creating answer");

      const localStream = await getLocalStream();
      onLocalStreamRef.current?.(localStream);

      const pc = createPC();
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock.emit("webrtc:answer", { roomId, answer });
      console.log("[WebRTC] Answer sent");
    };

    // When we receive an answer, set remote description
    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log("[WebRTC] Received answer");
      if (pcRef.current && pcRef.current.signalingState === "have-local-offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    // Relay ICE candidates
    const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.warn("[WebRTC] ICE candidate ignored:", err);
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
  }, [roomId, accessToken, createPC, getLocalStream, sendOffer]);

  return { startCall, endCall, localStreamRef };
}
