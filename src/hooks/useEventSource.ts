import { useEffect, useRef, useCallback } from 'react';

export interface QueueUpdateData {
  departmentId: string;
  doctorId: string;
  queue: Array<{
    tokenId: string;
    tokenValue: string;
    priority: "NORMAL" | "HIGH" | "EMERGENCY";
    departmentId: string;
    doctorId: string;
    patientId: string;
    patientName: string;
    score: number;
    rank: number;
    status?: 'PENDING' | 'CALLED' | 'COMPLETED' | 'CANCELLED';
  }>;
  departmentName?: string;
  doctorName?: string;
}

export interface TokenCalledData {
  tokenId: string;
  tokenValue: string;
  departmentId: string;
  doctorId: string;
  status: 'CALLED';
}

export interface TokenCompletedData {
  tokenId: string;
  tokenValue: string;
  departmentId: string;
  doctorId: string;
  status: 'COMPLETED';
}

export interface TokenCancelledData {
  tokenId: string;
  tokenValue: string;
  departmentId: string;
  doctorId: string;
  status: 'CANCELLED';
}

interface UseEventSourceProps {
  departmentId: string;
  doctorId: string;
  onMessage: (data: QueueUpdateData) => void;
  onTokenCalled?: (data: TokenCalledData) => void;
  onTokenCompleted?: (data: TokenCompletedData) => void;
  onTokenCancelled?: (data: TokenCancelledData) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

export const useEventSource = ({ 
  departmentId, 
  doctorId, 
  onMessage, 
  onTokenCalled,
  onTokenCompleted,
  onTokenCancelled,
  onError, 
  onOpen 
}: UseEventSourceProps) => {
  const eventSource = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<number>();
  const isMounted = useRef(true);

  const cleanup = useCallback(() => {
    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (!isMounted.current) return cleanup;

    // If either ID is missing, clean up and wait for both to be available
    if (!departmentId || !doctorId) {
      cleanup();
      return;
    }

    // Close any existing connection
    cleanup();

    // Reset reconnection attempts when changing department/doctor
    reconnectAttempts.current = 0;

    const url = `${import.meta.env.VITE_BASE_URL}/sse/events?department=${departmentId}&doctorId=${doctorId}`;
    console.log(`[SSE] Connecting to: ${url}`);
    
    const source = new EventSource(url, { withCredentials: true });
    eventSource.current = source;
    
    console.log('[SSE] EventSource created, readyState:', source.readyState);

    const handleQueueUpdate = (event: MessageEvent) => {
      if (!isMounted.current) return;
      
      try {
        console.log('[SSE] Received queue_update event:', event);
        const eventData = JSON.parse(event.data);
        console.log('[SSE] Parsed queue update data:', eventData);
        onMessage(eventData);
        // Reset reconnection attempts on successful message
        reconnectAttempts.current = 0;
      } catch (e) {
        console.error('[SSE] Error parsing queue update data:', e, 'Raw data:', event.data);
      }
    };

    const handleTokenCalled = (event: MessageEvent) => {
      if (!isMounted.current || !onTokenCalled) return;
      
      try {
        console.log('[SSE] Received token_called event:', event);
        const tokenData = JSON.parse(event.data);
        console.log('[SSE] Parsed token called data:', tokenData);
        onTokenCalled(tokenData);
        // Reset reconnection attempts on successful message
        reconnectAttempts.current = 0;
      } catch (e) {
        console.error('[SSE] Error parsing token called data:', e, 'Raw data:', event.data);
      }
    };

    const handleOpen = () => {
      console.log('[SSE] Connection opened, readyState:', eventSource.current?.readyState);
      reconnectAttempts.current = 0;
      onOpen?.();
    };

    const handleError = (event: Event) => {
      if (!isMounted.current) return;
      
      console.error('[SSE] Connection error, readyState:', eventSource.current?.readyState, 'Event:', event);
      onError?.(event);
      
      // Close the current connection
      if (source) {
        console.log('[SSE] Closing source due to error');
        source.close();
      }

      // Exponential backoff for reconnection
      const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;
      
      console.log(`[SSE] Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts.current})`);
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMounted.current && departmentId && doctorId) {
          console.log('[SSE] Executing reconnection attempt', reconnectAttempts.current);
          connectSSE();
        } else {
          console.log('[SSE] Not reconnecting - missing departmentId or doctorId or unmounted');
        }
      }, timeout);
    };

    const handleTokenCompleted = (event: MessageEvent) => {
      if (!isMounted.current || !onTokenCompleted) return;
      
      try {
        console.log('[SSE] Received token_completed event:', event);
        const tokenData = JSON.parse(event.data);
        console.log('[SSE] Parsed token completed data:', tokenData);
        onTokenCompleted(tokenData);
        reconnectAttempts.current = 0;
      } catch (e) {
        console.error('[SSE] Error parsing token completed data:', e, 'Raw data:', event.data);
      }
    };

    const handleTokenCancelled = (event: MessageEvent) => {
      if (!isMounted.current || !onTokenCancelled) return;
      
      try {
        console.log('[SSE] Received token_cancelled event:', event);
        const tokenData = JSON.parse(event.data);
        console.log('[SSE] Parsed token cancelled data:', tokenData);
        onTokenCancelled(tokenData);
        reconnectAttempts.current = 0;
      } catch (e) {
        console.error('[SSE] Error parsing token cancelled data:', e, 'Raw data:', event.data);
      }
    };

    // Set up event listeners
    source.addEventListener('queue_update', handleQueueUpdate);
    source.addEventListener('token_called', handleTokenCalled);
    source.addEventListener('token_completed', handleTokenCompleted);
    source.addEventListener('token_cancelled', handleTokenCancelled);
    source.addEventListener('error', handleError);
    source.addEventListener('open', handleOpen);

    // Cleanup function
    return () => {
      source.removeEventListener('queue_update', handleQueueUpdate);
      source.removeEventListener('token_called', handleTokenCalled);
      source.removeEventListener('token_completed', handleTokenCompleted);
      source.removeEventListener('token_cancelled', handleTokenCancelled);
      source.removeEventListener('error', handleError);
      source.removeEventListener('open', handleOpen);
      source.close();
    };
  }, [departmentId, doctorId, onMessage, onError, onOpen, cleanup]);

  // Initialize SSE connection
  useEffect(() => {
    isMounted.current = true;
    connectSSE();

    return () => {
      isMounted.current = false;
      cleanup();
    };
  }, [connectSSE, cleanup, departmentId, doctorId]);

  return { cleanup };
};
