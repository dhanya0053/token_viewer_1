import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Department, Doctor } from "../types";
import {
    RefreshCw,
    Clock,
    Users,
    ChevronLeft,
    ChevronRight,
    Building2,
    AlertTriangle,
    Syringe,
} from "lucide-react";
import { api, updateTokenStatus } from "../lib/api";
import {
    useEventSource,
    QueueUpdateData,
    TokenCalledData,
} from "../hooks/useEventSource";

interface QueueDisplayProps {
    departments: Department[];
    doctors: Doctor[];
}

interface QueueItem {
    tokenId: string;
    tokenValue: string;
    priority: "NORMAL" | "HIGH" | "EMERGENCY";
    departmentId: string;
    score: number;
    rank: number;
    patientName?: string;
}

type QueueState = Omit<QueueUpdateData, "queue"> & {
    queue: QueueItem[];
};

export const QueueDisplay: React.FC<QueueDisplayProps> = ({
    departments,
    doctors,
}) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [selectedDepartmentId, setSelectedDepartmentId] =
        useState<string>("");
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
    const [waitingQueues, setWaitingQueues] = useState<QueueState[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [activeTokens, setActiveTokens] = useState<
        Record<
            string,
            { current: QueueItem | null; previous: QueueItem | null }
        >
    >({});
    const [lastCalledToken, setLastCalledToken] =
        useState<TokenCalledData | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Handle queue updates from SSE - this is for the waiting list
    const handleQueueUpdate = useCallback((data: QueueUpdateData) => {
        setIsLoading(false);
        console.log("[Queue Update] Received data:", data);
        if (!data?.departmentId || !data?.doctorId) {
            console.error("Invalid queue update data:", data);
            return;
        }

        setWaitingQueues((prev) => {
            const newQueueState: QueueState = {
                departmentId: data.departmentId,
                departmentName: data.departmentName || "",
                doctorId: data.doctorId,
                doctorName: data.doctorName || "",
                queue: Array.isArray(data.queue) ? data.queue : [],
            };

            const existingIndex = prev.findIndex(
                (q) =>
                    q.departmentId === data.departmentId &&
                    q.doctorId === data.doctorId
            );

            if (existingIndex >= 0) {
                const newStates = [...prev];
                newStates[existingIndex] = newQueueState;
                return newStates;
            }
            return [...prev, newQueueState];
        });
        setError(null);
    }, []);

    // Call the next token (mark as IN_PROGRESS)
    const callNextToken = async () => {
        if (!currentDisplayQueueState?.doctorId || !nextToken) return;
        
        const tokenId = nextToken.tokenId;
        const key = `${currentDisplayQueueState.departmentId}-${currentDisplayQueueState.doctorId}`;
        
        try {
            setIsUpdating(true);
            
            // 1. Optimistically update the active tokens
            setActiveTokens(prev => ({
                ...prev,
                [key]: {
                    current: nextToken,
                    previous: prev[key]?.current || null
                }
            }));
            
            // 2. Optimistically remove the token from the waiting queue
            setWaitingQueues(prev => 
                prev.map(q => {
                    if (
                        q.departmentId === currentDisplayQueueState.departmentId &&
                        q.doctorId === currentDisplayQueueState.doctorId
                    ) {
                        return {
                            ...q,
                            queue: q.queue.filter(t => t.tokenId !== tokenId)
                        };
                    }
                    return q;
                })
            );
            
            // 3. Update the token status
            await updateTokenStatus(tokenId, 'IN_PROGRESS', currentDisplayQueueState.doctorId);
            
        } catch (error) {
            console.error('Error calling next token:', error);
            setError('Failed to call next token. Please try again.');
            fetchQueueData(); // Refresh to restore correct state
        } finally {
            setIsUpdating(false);
        }
    };
    
    // Complete the current token (mark as COMPLETED)
    const completeCurrentToken = async () => {
        if (!currentDisplayQueueState?.doctorId || !currentToken) return;
        
        const tokenId = currentToken.tokenId;
        const key = `${currentDisplayQueueState.departmentId}-${currentDisplayQueueState.doctorId}`;
        
        try {
            setIsUpdating(true);
            
            // 1. Optimistically move current to previous and clear current
            setActiveTokens(prev => ({
                ...prev,
                [key]: {
                    current: null,
                    previous: prev[key]?.current || null
                }
            }));
            
            // 2. Update the token status
            await updateTokenStatus(tokenId, 'COMPLETED', currentDisplayQueueState.doctorId);
            
        } catch (error) {
            console.error('Error completing token:', error);
            setError('Failed to complete token. Please try again.');
            fetchQueueData(); // Refresh to restore correct state
        } finally {
            setIsUpdating(false);
        }
    };

    const handleTokenCalled = useCallback((data: TokenCalledData) => {
        console.log("[Token Called] Event received:", data);
        setLastCalledToken(data);
    }, []);

    // Effect to process the last called token
    useEffect(() => {
        if (!lastCalledToken) return;

        const { departmentId, doctorId, tokenId } = lastCalledToken;
        let calledToken: QueueItem | null = null;

        // Find the token in the waiting queue
        const queueState = waitingQueues.find(
            (q) => q.departmentId === departmentId && q.doctorId === doctorId
        );

        if (queueState) {
            calledToken =
                queueState.queue.find((t) => t.tokenId === tokenId) || null;
        }

        if (calledToken) {
            console.log(
                `[Token Processing] Moving token ${calledToken.tokenValue} to active.`
            );
            // 1. Remove from waiting queue
            setWaitingQueues((prev) =>
                prev.map((q) => {
                    if (
                        q.departmentId === departmentId &&
                        q.doctorId === doctorId
                    ) {
                        return {
                            ...q,
                            queue: q.queue.filter((t) => t.tokenId !== tokenId),
                        };
                    }
                    return q;
                })
            );

            // 2. Set as active token
            const key = `${departmentId}-${doctorId}`;
            setActiveTokens((prev) => {
                const currentActive = prev[key] || {
                    current: null,
                    previous: null,
                };
                return {
                    ...prev,
                    [key]: {
                        previous: currentActive.current,
                        current: calledToken,
                    },
                };
            });
        } else {
            console.warn(
                `[Token Processing] Called token ${tokenId} not found in any waiting queue.`
            );
        }

        // Reset for next event
        setLastCalledToken(null);
    }, [lastCalledToken, waitingQueues]);

    const fetchQueueData = useCallback(async () => {
        if (!selectedDepartmentId && !selectedDoctorId) return;

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (selectedDepartmentId)
                params.append("departmentId", selectedDepartmentId);
            if (selectedDoctorId) params.append("doctorId", selectedDoctorId);

            const response = await api<QueueState | QueueState[]>(
                `/queue?${params.toString()}`
            );
            if (!response) throw new Error("Failed to fetch queue data");

            const queueData = Array.isArray(response) ? response : [response];
            const transformedData = queueData.map((queue) => ({
                departmentId: queue.departmentId,
                departmentName: queue.departmentName || "Unknown Department",
                doctorId: queue.doctorId,
                doctorName: queue.doctorName || "Unknown Doctor",
                queue: queue.queue || [],
            }));

            setWaitingQueues(transformedData);

            // On a full refresh, we should clear the active tokens for the fetched queues
            // to avoid showing stale data, as the waiting queue is the source of truth.
            setActiveTokens((prev) => {
                const newActiveTokens = { ...prev };
                for (const q of transformedData) {
                    const key = `${q.departmentId}-${q.doctorId}`;
                    newActiveTokens[key] = { current: null, previous: null };
                }
                return newActiveTokens;
            });

            setLastRefresh(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            console.error("Error fetching queue data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDepartmentId, selectedDoctorId]);

    const eventSourceConfig = useMemo(
        () => ({
            departmentId: selectedDepartmentId,
            doctorId: selectedDoctorId,
            onMessage: handleQueueUpdate,
            onTokenCalled: handleTokenCalled,
            onError: (error: Event) => {
                console.error("SSE error:", error);
                setError("Connection error. Attempting to reconnect...");
            },
            onOpen: () => {
                console.log("SSE connection established");
                setError(null);
                fetchQueueData(); // Fetch latest state on connect
            },
        }),
        [
            selectedDepartmentId,
            selectedDoctorId,
            handleQueueUpdate,
            handleTokenCalled,
            fetchQueueData,
        ]
    );

    useEventSource(eventSourceConfig);

    const formatTime = (date: Date) =>
        date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    const formatDate = (date: Date) =>
        date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

    const getDepartmentColor = (departmentId: string) => {
        const colorMap: { [key: string]: string } = {
            "dept-general": "from-emerald-500 to-emerald-600",
            "dept-cardiology": "from-red-500 to-red-600",
            "dept-orthopedics": "from-orange-500 to-orange-600",
            "dept-pediatrics": "from-pink-500 to-pink-600",
            "dept-dermatology": "from-purple-500 to-purple-600",
            "dept-neurology": "from-indigo-500 to-indigo-600",
            default: "from-blue-500 to-blue-600",
        };
        return colorMap[departmentId] || colorMap.default;
    };

    const getPriorityClasses = (priority: QueueItem["priority"]) => {
        switch (priority) {
            case "EMERGENCY":
                return "bg-red-500 text-white";
            case "HIGH":
                return "bg-yellow-500 text-black";
            default:
                return "bg-gray-200 text-gray-700";
        }
    };

    const getPriorityIcon = (priority: QueueItem["priority"]) => {
        switch (priority) {
            case "EMERGENCY":
                return <AlertTriangle className="w-4 h-4 mr-1" />;
            case "HIGH":
                return <Syringe className="w-4 h-4 mr-1" />;
            default:
                return null;
        }
    };

    useEffect(() => {
        if (
            (selectedDepartmentId && selectedDoctorId) ||
            (selectedDepartmentId && selectedDepartmentId === "all")
        ) {
            fetchQueueData();
        }
    }, [selectedDepartmentId, selectedDoctorId, fetchQueueData]);

    const filteredDoctors = useMemo(() => {
        return selectedDepartmentId && selectedDepartmentId !== "all"
            ? doctors.filter((doc) => doc.departmentId === selectedDepartmentId)
            : doctors;
    }, [selectedDepartmentId, doctors]);

    const currentDisplayQueueState = useMemo(() => {
        if (selectedDoctorId) {
            return waitingQueues.find(
                (qs) =>
                    qs.doctorId === selectedDoctorId &&
                    (selectedDepartmentId === "all" ||
                        qs.departmentId === selectedDepartmentId)
            );
        }
        if (selectedDepartmentId && selectedDepartmentId !== "all") {
            return waitingQueues.find(
                (qs) => qs.departmentId === selectedDepartmentId
            );
        }
        if (waitingQueues.length > 0) {
            return waitingQueues[0]; // Simplified fallback for "All"
        }
        return null;
    }, [waitingQueues, selectedDepartmentId, selectedDoctorId]);

    const activeTokensKey = currentDisplayQueueState
        ? `${currentDisplayQueueState.departmentId}-${currentDisplayQueueState.doctorId}`
        : null;
    const activeState = activeTokensKey ? activeTokens[activeTokensKey] : null;

    const currentToken = activeState?.current || null;
    const previousToken = activeState?.previous || null;

    const waitingQueue = currentDisplayQueueState?.queue || [];
    const nextToken = waitingQueue[0] || null;
    const upcomingTokens = waitingQueue.slice(1, 4) || [];

    const selectedDeptDetails = departments.find(
        (dept) => dept.id === selectedDepartmentId
    );
    const selectedDoctorDetails = doctors.find(
        (doc) => doc.id === selectedDoctorId
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-y-auto">
            <div className="flex justify-between items-start mb-12">
                <div className="flex-1">
                    <h1 className="text-5xl font-bold text-slate-800 mb-2">
                        Patient Queue Display
                    </h1>
                    <p className="text-2xl text-slate-600 mb-6">
                        Medical Center - Token Management System
                    </p>
                    <div className="flex items-center space-x-4 mb-4">
                        <Building2 className="w-6 h-6 text-slate-600" />
                        <span className="text-xl font-medium text-slate-700">
                            Department:
                        </span>
                        <select
                            value={selectedDepartmentId}
                            onChange={(e) => {
                                setSelectedDepartmentId(e.target.value);
                                setSelectedDoctorId("");
                            }}
                            className="text-xl px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                        >
                            <option value="all">All Departments</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Users className="w-6 h-6 text-slate-600" />
                        <span className="text-xl font-medium text-slate-700">
                            Doctor:
                        </span>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) =>
                                setSelectedDoctorId(e.target.value)
                            }
                            disabled={filteredDoctors.length === 0}
                            className="text-xl px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors disabled:bg-gray-100"
                        >
                            <option value="">All Doctors</option>
                            {filteredDoctors.map((doctor) => (
                                <option key={doctor.id} value={doctor.id}>
                                    Dr. {doctor.fullName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-mono text-slate-800 mb-2">
                        {formatTime(currentTime)}
                    </div>
                    <div className="text-xl text-slate-600">
                        {formatDate(currentTime)}
                    </div>
                    <div className="flex items-center text-lg text-slate-500 mt-2">
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Last updated: {formatTime(lastRefresh)}
                    </div>
                    <div className="flex flex-col gap-3">

                    <button
                        onClick={callNextToken}
                        disabled={isUpdating || !nextToken}
                        className="mt-4 bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-2 rounded-xl font-medium text-lg border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? "Updating..." : "Call next token"}
                    </button>
                    <button
                        onClick={completeCurrentToken}
                        disabled={isUpdating || !currentToken}
                        className="mt-4 bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-2 rounded-xl font-medium text-lg border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? "Updating..." : "Complete current token"}
                    </button>
                    </div>
                </div>
            </div>

            {(selectedDepartmentId && selectedDepartmentId !== "all") ||
            selectedDoctorId ? (
                <div
                    className={`bg-gradient-to-r ${getDepartmentColor(
                        selectedDepartmentId
                    )} text-white rounded-2xl p-6 mb-8 shadow-lg`}
                >
                    <div className="flex items-center justify-center">
                        <Building2 className="w-8 h-8 mr-3" />
                        <h2 className="text-3xl font-bold truncate">
                            {selectedDoctorDetails?.fullName
                                ? `Dr. ${selectedDoctorDetails.fullName}`
                                : selectedDeptDetails?.name || "Selected Queue"}
                        </h2>
                        <span className="ml-4 bg-white/20 px-4 py-2 rounded-full text-lg whitespace-nowrap">
                            {waitingQueue.length || 0} patients waiting
                        </span>
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex items-center justify-center">
                        <Building2 className="w-8 h-8 mr-3" />
                        <h2 className="text-3xl font-bold">
                            All Departments Overview
                        </h2>
                        <span className="ml-4 bg-white/20 px-4 py-2 rounded-full text-lg whitespace-nowrap">
                            {waitingQueues.reduce(
                                (acc, curr) => acc + curr.queue.length,
                                0
                            )}{" "}
                            total patients waiting
                        </span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-lg h-[320px] flex flex-col">
                    <div className="flex items-center justify-center mb-6">
                        <ChevronLeft className="w-8 h-8 text-slate-500 mr-2" />
                        <h2 className="text-xl font-semibold text-slate-600">
                            Previous
                        </h2>
                    </div>
                    <div className="flex-grow flex flex-col justify-center text-center">
                        {previousToken ? (
                            <div>
                                <div className="text-4xl font-bold text-slate-400 mb-3">
                                    #{previousToken.tokenValue}
                                </div>
                                <div
                                    className="text-2xl font-medium text-slate-600 mb-2 truncate"
                                    title={
                                        selectedDoctorDetails?.fullName ||
                                        currentDisplayQueueState?.doctorName
                                    }
                                >
                                    {selectedDoctorDetails?.fullName ||
                                        currentDisplayQueueState?.doctorName}
                                </div>
                                <div className="text-lg text-slate-500 flex items-center justify-center mb-2">
                                    <Clock className="w-5 h-5 mr-2" />
                                    {formatTime(lastRefresh)}
                                </div>
                                <div
                                    className={`text-base font-medium flex items-center justify-center px-2 py-1 rounded-full mx-auto w-fit ${getPriorityClasses(
                                        previousToken.priority
                                    )}`}
                                >
                                    {getPriorityIcon(previousToken.priority)}
                                    {previousToken.priority} Priority
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-400">
                                <div className="text-3xl mb-3">-</div>
                                <div className="text-lg">No previous token</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-8 shadow-2xl transform scale-110 h-[480px] flex flex-col">
                    <div className="text-center text-white flex-grow flex flex-col justify-center">
                        <h2 className="text-4xl font-semibold mb-8 flex items-center justify-center">
                            <Users className="w-10 h-10 mr-4" />
                            Now Serving
                        </h2>
                        {currentToken ? (
                            <>
                                <div className="text-4xl font-bold mb-6">
                                    #{currentToken.tokenValue}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-2xl font-medium text-gray-600 truncate" title={
                                        selectedDoctorDetails?.fullName ||
                                        currentDisplayQueueState?.doctorName || 'Doctor'
                                    }>
                                        {selectedDoctorDetails?.fullName ||
                                            currentDisplayQueueState?.doctorName || 'Doctor'}
                                    </div>
                                    <div className="text-3xl font-semibold truncate text-white" title={'Patient'}>
                                        {currentToken.patientName|| 'Patient'}
                                    </div>
                                </div>
                                <div
                                    className={`bg-white/20 backdrop-blur-sm rounded-xl p-3 mb-4 flex items-center justify-center text-2xl font-medium`}
                                >
                                    {getPriorityIcon(currentToken.priority)}
                                    {currentToken.priority} Priority
                                </div>
                                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-xl font-medium mb-4">
                                    Please proceed to consultation room
                                </div>
                            </>
                        ) : (
                            <div>
                                <div className="text-6xl mb-8">-</div>
                                <div className="text-3xl">
                                    No token being served
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl p-6 border-2 border-amber-200 shadow-lg h-[320px] flex flex-col">
                    <div className="flex items-center justify-center mb-6">
                        <h2 className="text-xl font-semibold text-amber-700 mr-2">
                            Next
                        </h2>
                        <ChevronRight className="w-8 h-8 text-amber-600" />
                    </div>
                    <div className="flex-grow flex flex-col justify-center text-center">
                        {nextToken ? (
                            <div>
                                <div className="text-4xl font-bold text-amber-600 mb-3">
                                    #{nextToken.tokenValue}
                                </div>
                                <div
                                    className="text-2xl font-medium text-amber-800 mb-2 truncate"
                                    title={
                                        selectedDoctorDetails?.fullName ||
                                        currentDisplayQueueState?.doctorName
                                    }
                                >
                                    {selectedDoctorDetails?.fullName ||
                                        currentDisplayQueueState?.doctorName}
                                </div>
                                <div className="text-lg text-amber-700 flex items-center justify-center mb-2">
                                    <Clock className="w-5 h-5 mr-2" />
                                    Waiting...
                                </div>
                                <div
                                    className={`text-base font-medium flex items-center justify-center px-2 py-1 rounded-full mx-auto w-fit ${getPriorityClasses(
                                        nextToken.priority
                                    )}`}
                                >
                                    {getPriorityIcon(nextToken.priority)}
                                    {nextToken.priority} Priority
                                </div>
                            </div>
                        ) : (
                            <div className="text-amber-600">
                                <div className="text-3xl mb-3">-</div>
                                <div className="text-lg">No next token</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white/70 mt-5 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-lg">
                <h3 className="text-2xl font-semibold text-slate-700 mb-4 text-center">
                    Waiting Queue
                </h3>
                {upcomingTokens.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingTokens.map((token) => (
                                <div
                                    key={token.tokenId}
                                    className="bg-white rounded-xl p-4 border border-slate-150 shadow-sm"
                                >
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-600 mb-2">
                                            #{token.tokenValue}
                                        </div>
                                        <div
                                            className="text-lg font-medium text-slate-700 mb-1 truncate"
                                            title={
                                                doctors.find(
                                                    (d) =>
                                                        d.id ===
                                                        currentDisplayQueueState?.doctorId
                                                )?.fullName || "Doctor"
                                            }
                                        >
                                            {doctors.find(
                                                (d) =>
                                                    d.id ===
                                                    currentDisplayQueueState?.doctorId
                                            )?.fullName || "Doctor"}
                                        </div>
                                        <div
                                            className="text-sm text-slate-500 capitalize mb-2 truncate"
                                            title={
                                                departments.find(
                                                    (d) =>
                                                        d.id ===
                                                        token.departmentId
                                                )?.name || "Department"
                                            }
                                        >
                                            {departments.find(
                                                (d) =>
                                                    d.id === token.departmentId
                                            )?.name || "Department"}
                                        </div>
                                        <div
                                            className={`text-xs font-medium flex items-center justify-center px-2 py-1 rounded-full mx-auto w-fit ${getPriorityClasses(
                                                token.priority
                                            )}`}
                                        >
                                            {getPriorityIcon(token.priority)}
                                            {token.priority} Priority
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-8">
                        <div className="text-4xl mb-4">📋</div>
                        <div className="text-lg">
                            The waiting queue is empty
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 text-center">
                <div className="text-xl text-slate-600 mb-2">
                    Queue Status: {waitingQueue.length || 0} patients waiting
                    {selectedDepartmentId &&
                        selectedDepartmentId !== "all" &&
                        ` in ${selectedDeptDetails?.name}`}
                    {selectedDoctorId &&
                        ` for Dr. ${selectedDoctorDetails?.fullName}`}
                </div>
                <div className="text-lg text-slate-500">
                    System Status: Online • Auto-refresh via SSE
                </div>
            </div>
        </div>
    );
}    

export default React.memo(QueueDisplay);
