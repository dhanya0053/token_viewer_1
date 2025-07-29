import { useEffect, useRef, useCallback } from 'react';

// Type definitions (keep these as they are)
export type TokenStatus = "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TokenPriority = "NORMAL" | "HIGH" | "EMERGENCY";

export interface QueueItem {
  tokenId: string;
  tokenValue: string;
  priority: TokenPriority;
  patientId: string;
  patientName: string;
  scheduledDate: string;
  status: TokenStatus;
  score: number;
  rank: number;
}

export interface QueueUpdateData {
  departmentId: string;
  doctorId: string;
  departmentName?: string;
  doctorName?: string;
  queue: Array<QueueItem>;
  active: QueueItem | null;
  previous: QueueItem | null;
  waiting: Array<QueueItem>;
  totalPatients: number;
  timestamp: string; // ISO 8601 string
}

export interface TokenData {
  tokenId: string;
  tokenValue: string;
  departmentId: string;
  doctorId: string;
  patientName: string;
  priority: TokenPriority;
  status: TokenStatus;
}
interface UseEventSourceProps {
  departmentId?: string | null;
  doctorId?: string | null;
  onMessage: (data: QueueUpdateData) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void; // For initial successful connection
  onReconnect?: () => void; // NEW: For successful reconnections after an error
  reconnectOnClose?: boolean;
}

export const useEventSource = ({
  departmentId,
  doctorId,
  onMessage,
  onError,
  onOpen,
  onReconnect,
  reconnectOnClose = true
}: UseEventSourceProps) => {
  const eventSource = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<number>();
  const isInitialConnect = useRef(true);
  const lastDepartmentId = useRef(departmentId);
  const lastDoctorId = useRef(doctorId);
  const hasBothIds = useRef(!!(departmentId && doctorId));

  // Use refs for the callbacks
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);
  const onReconnectRef = useRef(onReconnect);
  const reconnectOnCloseRef = useRef(reconnectOnClose);

  // Update the refs whenever the props change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onOpenRef.current = onOpen;
    onReconnectRef.current = onReconnect;
    reconnectOnCloseRef.current = reconnectOnClose;
  }, [onMessage, onError, onOpen, onReconnect, reconnectOnClose]);

  const cleanup = useCallback(() => {
    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
      console.log('[SSE] Connection closed.');
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const buildSSEUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);
    if (doctorId) params.append('doctorId', doctorId);
    return `${import.meta.env.VITE_BASE_URL}/sse/events?${params.toString()}`;
  }, [departmentId, doctorId]);

  const connectSSE = useCallback(() => {
    // Only connect if we have both departmentId and doctorId
    if (!departmentId || !doctorId) {
      console.log('[SSE] Skipping connection: both departmentId and doctorId are required');
      return;
    }

    // Log the base URL being used
    console.log('[SSE] Using base URL:', import.meta.env.VITE_BASE_URL);
    if (!import.meta.env.VITE_BASE_URL) {
      console.error('[SSE] VITE_BASE_URL is not set. Please check your environment variables.');
      return;
    }

    // Clean up any existing connection
    cleanup();

    // Reset reconnection attempts
    reconnectAttempts.current = 0;

    const url = buildSSEUrl();
    console.log(`[SSE] Connecting to: ${url}`);

    try {
      const source = new EventSource(url, { withCredentials: true });
      eventSource.current = source;

      const createEventHandler = <T,>(handlerRef: React.MutableRefObject<((data: T) => void) | undefined>, eventName: string) => 
        (event: MessageEvent) => {
          if (!handlerRef.current) return;
          try {
            const data = JSON.parse(event.data);
            console.log(`[SSE] Received ${eventName}:`, data);
            handlerRef.current(data);
          } catch (e) {
            console.error(`[SSE] Error parsing ${eventName} data:`, e, 'Raw data:', event.data);
          }
        };

      source.onopen = () => {
        console.log('[SSE] Connection opened.');
        reconnectAttempts.current = 0;
        if (isInitialConnect.current) {
          onOpenRef.current?.();
          isInitialConnect.current = false;
        } else {
          onReconnectRef.current?.();
        }
      };

      source.onerror = (event: Event) => {
        console.error('[SSE] Connection error:', event);
        console.error('[SSE] Ready State:', (event.target as EventSource)?.readyState);
        onErrorRef.current?.(event);
        
        // Close the current connection
        source.close();
        
        if (reconnectOnCloseRef.current && reconnectAttempts.current < 5) { // Limit to 5 attempts for now
          const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000); // Max 10s delay
          const jitter = Math.random() * 1000;
          const timeout = baseDelay + jitter;
          
          reconnectAttempts.current++;
          console.log(`[SSE] Attempting to reconnect in ${Math.round(timeout)}ms (attempt ${reconnectAttempts.current}/5)`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (departmentId && doctorId) {
              console.log('[SSE] Reconnecting...');
              connectSSE();
            }
          }, timeout);
        } else if (reconnectAttempts.current >= 5) {
          const errorMsg = '[SSE] Maximum reconnection attempts reached. Please check if the server is running and accessible.';
          console.error(errorMsg);
          alert(errorMsg + '\n\nCheck the console for more details.');
        }
      };

      // Set up event listeners
      source.addEventListener('queue_update', createEventHandler(onMessageRef, 'queue_update'));
      return () => {
        source.close();
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
      };
    } catch (error) {
      console.error('[SSE] Error creating EventSource:', error);
    }
  }, [departmentId, doctorId, buildSSEUrl, cleanup]);

  // Main effect to handle connection setup and cleanup
  useEffect(() => {
    const bothIdsNow = !!(departmentId && doctorId);
    const idsChanged = departmentId !== lastDepartmentId.current || doctorId !== lastDoctorId.current;

    if (bothIdsNow && (idsChanged || !hasBothIds.current)) {
      // We have both IDs now (either just got them or they changed)
      lastDepartmentId.current = departmentId;
      lastDoctorId.current = doctorId;
      hasBothIds.current = true;
      connectSSE();
    } else if (!bothIdsNow && hasBothIds.current) {
      // We had both IDs before but now we don't
      hasBothIds.current = false;
      cleanup();
    }

    return () => {
      // Only clean up if we're not reconnecting or if we no longer have both IDs
      if (!reconnectOnCloseRef.current || !hasBothIds.current) {
        cleanup();
      }
    };
  }, [departmentId, doctorId, connectSSE, cleanup]);

  // No need to return anything as we're using callbacks
  return null;
};