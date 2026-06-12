import { useEffect, useRef, useCallback } from "react";
import { initSocket } from "../services/socket";

interface UseWebRTCOptions {
  roomId: string;
  accessToken: string;
  onRemoteStream?: (stream: MediaStream) => void;
}

export function useWebRTC({ roomId, accessToken, onRemoteStream }: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        initSocket(accessToken).emit("webrtc:ice-candidate", { roomId, candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      if (streams[0]) onRemoteStream?.(streams[0]);
    };

    pcRef.current = pc;
    return pc;
  }, [roomId, accessToken, onRemoteStream]);

  // Usuario A: inicia la llamada
  const startCall = useCallback(async (): Promise<MediaStream> => {
    const pc = createPC();
    const sock = initSocket(accessToken);

    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = localStream;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sock.emit("webrtc:offer", { roomId, offer });

    return localStream;
  }, [roomId, accessToken, createPC]);

  const endCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  // Escucha señalización entrante
  useEffect(() => {
    const sock = initSocket(accessToken);

    // Usuario B: recibe oferta y responde
    const onOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      const pc = createPC();

      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock.emit("webrtc:answer", { roomId, answer });
    };

    // Usuario A: recibe respuesta
    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    };

    // Ambos: agregan candidatos ICE del otro
    const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("ICE candidate ignorado:", err);
      }
    };

    sock.on("webrtc:offer", onOffer);
    sock.on("webrtc:answer", onAnswer);
    sock.on("webrtc:ice-candidate", onIceCandidate);

    return () => {
      sock.off("webrtc:offer", onOffer);
      sock.off("webrtc:answer", onAnswer);
      sock.off("webrtc:ice-candidate", onIceCandidate);
    };
  }, [roomId, accessToken, createPC]);

  return { startCall, endCall, localStreamRef };
}