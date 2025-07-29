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
import { api, updateTokenStatus, updateTokenPriority } from "../lib/api";
import {
    useEventSource,
    QueueUpdateData,
    TokenData,
} from "../hooks/useEventSource";
import UpdatePriorityButton from "../components/UpdatePriorityButton";

// Interfaces
interface QueueDisplayProps {
    departments: Department[];
    doctors: Doctor[];
}

interface QueueItem {
    tokenId: string;
    tokenValue: string;
    priority: "NORMAL" | "HIGH" | "EMERGENCY";
    patientId: string
;
    patientName: string;
    scheduledDate: string;
    status: "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    score: number;
    rank: number;
}

interface DoctorQueueState {
    departmentId: string;
    departmentName: string;
    doctorId: string;
    doctorName: string;
    waiting: QueueItem[];
    active: QueueItem | null;
    previous: QueueItem | null;
    totalPatients: number;
    timestamp: Date | null;
}

type QueuesState = Record<string, DoctorQueueState>; // Key: doctorId

export const QueueDisplay: React.FC<QueueDisplayProps> = ({
    departments,
    doctors,
}) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<
        string | null
    >(null);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
        null
    );
    const [queues, setQueues] = useState<QueuesState>({});
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingPriorities, setUpdatingPriorities] = useState<
        Record<string, boolean>
    >({});
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Centralized state update for a specific doctor's queue
    const updateDoctorQueue = useCallback(
        (
            doctorId: string,
            updateFn: (prevState: DoctorQueueState) => DoctorQueueState
        ) => {
            setQueues((prev) => {
                const existingState = prev[doctorId] || {
                    departmentId: "",
                    departmentName: "",
                    doctorId: doctorId,
                    doctorName:
                        doctors.find((d) => d.id === doctorId)?.fullName ||
                        "N/A",
                    waiting: [],
                    active: null,
                    previous: null,
                    totalPatients: 0,
                    timestamp: null,
                };
                return {
                    ...prev,
                    [doctorId]: updateFn(existingState),
                };
            });
        },
        [doctors]
    );

    // Handle queue updates from SSE
    const handleQueueUpdate = useCallback(
        (data: QueueUpdateData) => {
            console.log("[Queue Update] Received data:", data);
            if (!data?.doctorId) {
                console.error("Invalid queue update data:", data);
                return;
            }

            // Clear any previous connection errors on successful update
            setConnectionError(null);

            updateDoctorQueue(data.doctorId, (prevState) => {
                // Find the current active token in the new queue data
                const activeToken = Array.isArray(data.queue)
                    ? data.queue.find(
                          (token) => token.status === "IN_PROGRESS"
                      ) || null
                    : null;

                // Only update waiting list, keep the current active and previous tokens
                return {
                    ...prevState,
                    departmentId: data.departmentId,
                    departmentName:
                        data.departmentName || prevState.departmentName,
                    doctorName: data.doctorName || prevState.doctorName,
                    waiting: Array.isArray(data.queue)
                        ? data.queue.filter(
                              (token) => token.status === "CHECKED_IN"
                          )
                        : [],
                    active: activeToken || prevState.active, // Preserve active token if not in new data
                    // Don't update previous token from queue updates
                    totalPatients: data.totalPatients,
                    timestamp: new Date(data.timestamp),
                };
            });
        },
        [updateDoctorQueue]
    );


    // Fetch initial queue data
    const fetchQueueData = useCallback(async () => {
        if (!selectedDepartmentId && !selectedDoctorId) return;

        try {
            const params = new URLSearchParams();
            if (selectedDepartmentId) {
                params.append("departmentId", selectedDepartmentId);
            }
            if (!selectedDepartmentId) {
                throw new Error("Department ID is required");
            }
            if (selectedDoctorId) {
                params.append("doctorId", selectedDoctorId);
            }

            const response = await api<QueueUpdateData | QueueUpdateData[]>(
                `/queue?${params.toString()}`
            );
            console.log("[QueueDisplay] Fetched queue data:", response);
            if (!response) throw new Error("Failed to fetch queue data");

            const newQueuesState: QueuesState = {};
            if (!Array.isArray(response)) {
                newQueuesState[response.doctorId] = {
                    departmentId: response.departmentId,
                    departmentName:
                        response.departmentName || "Unknown Department",
                    doctorId: response.doctorId,
                    doctorName: response.doctorName || "Unknown Doctor",
                    waiting:
                        response.queue?.filter(
                            (token) => token.status === "CHECKED_IN"
                        ) || [],
                    active:
                        response.queue?.find(
                            (token) => token.status === "IN_PROGRESS"
                        ) || null,
                    previous:
                        response.queue?.find(
                            (token) => token.status === "COMPLETED"
                        ) || null,
                    totalPatients: response.totalPatients,
                    timestamp: new Date(response.timestamp),
                };
            } else {
                for (const queueData of response) {
                    newQueuesState[queueData.doctorId] = {
                        departmentId: queueData.departmentId,
                        departmentName:
                            queueData.departmentName || "Unknown Department",
                        doctorId: queueData.doctorId,
                        doctorName: queueData.doctorName || "Unknown Doctor",
                        waiting:
                            queueData.queue?.filter(
                                (token) => token.status === "CHECKED_IN"
                            ) || [],
                        active:
                            queueData.queue?.find(
                                (token) => token.status === "IN_PROGRESS"
                            ) || null,
                        previous:
                            queueData.queue?.find(
                                (token) => token.status === "COMPLETED"
                            ) || null,
                        totalPatients: queueData.totalPatients,
                        timestamp: new Date(queueData.timestamp),
                    };
                }
            }

            console.log("[QueueDisplay] Fetched queue data:", newQueuesState);
            setQueues(newQueuesState);
            setLastRefresh(new Date());
        } catch (err) {
            console.error("Error fetching queue data:", err);
        }
    }, [selectedDepartmentId, selectedDoctorId, doctors]);

    // Handle SSE errors
    const handleError = useCallback((error: Event) => {
        console.error("SSE error:", error);
        const errorMessage = `Connection error: ${error.type}. Please check if the server is running and accessible.`;
        setConnectionError(errorMessage);
    }, []);

    const handleOpen = useCallback(() => {
        console.log("SSE connection established");
        setConnectionError(null);
        fetchQueueData();
    }, [fetchQueueData]);

    // SSE connection setup
    useEventSource({
        departmentId: selectedDepartmentId,
        doctorId: selectedDoctorId,
        onMessage: handleQueueUpdate,
        onError: handleError,
        onOpen: handleOpen,
        reconnectOnClose: true,
    });

    // Actions
    const callNextToken = async () => {
        if (!currentDisplayQueue?.doctorId || !nextToken) return;

        const { doctorId } = currentDisplayQueue;
        const tokenId = nextToken.tokenId;
        setIsUpdating(true);
        try {
            // Optimistic update
            updateDoctorQueue(doctorId, (prevState) => ({
                ...prevState,
                waiting: prevState.waiting.filter((t) => t.tokenId !== tokenId),
                active: nextToken,
                previous: prevState.active,
            }));
            await updateTokenStatus(tokenId, "IN_PROGRESS", doctorId);
        } catch (error) {
            console.error("Error calling next token:", error);
            fetchQueueData(); // Re-fetch to correct state
        } finally {
            setIsUpdating(false);
        }
    };

    const completeCurrentToken = async () => {
        if (!currentDisplayQueue?.doctorId || !currentToken) return;

        const { doctorId } = currentDisplayQueue;
        const tokenId = currentToken.tokenId;
        setIsUpdating(true);
        try {
            // Optimistic update
            updateDoctorQueue(doctorId, (prevState) => ({
                ...prevState,
                active: null,
                previous: prevState.active,
            }));
            await updateTokenStatus(tokenId, "COMPLETED", doctorId);
        } catch (error) {
            console.error("Error completing token:", error);
            fetchQueueData(); // Re-fetch to correct state
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdatePriority = async (
        tokenId: string,
        action: "increase" | "decrease"
    ) => {
        setUpdatingPriorities((prev) => ({ ...prev, [tokenId]: true }));
        try {
            await updateTokenPriority(tokenId, action);
            // SSE will trigger a queue update
        } catch (error) {
            console.error("Failed to update token priority:", error);
        } finally {
            setUpdatingPriorities((prev) => ({ ...prev, [tokenId]: false }));
        }
    };

    // Memoized selectors for derived state
    const filteredDoctors = useMemo(() => {
        if (!selectedDepartmentId || selectedDepartmentId === "all")
            return doctors;
        return doctors.filter(
            (doc) => doc.departmentId === selectedDepartmentId
        );
    }, [selectedDepartmentId, doctors]);

    const currentDisplayQueue = useMemo(() => {
        if (selectedDoctorId) {
            return queues[selectedDoctorId] || null;
        }
        if (selectedDepartmentId) {
            // Find the first queue for the selected department if no doctor is selected
            const doctorInDept = doctors.find(
                (d) => d.departmentId === selectedDepartmentId
            );
            if (doctorInDept) {
                return queues[doctorInDept.id] || null;
            }
        }
        // Fallback for "All Departments" - show the first available queue or an aggregate view
        if (Object.keys(queues).length > 0) {
            return Object.values(queues)[0];
        }
        return null;
    }, [queues, selectedDepartmentId, selectedDoctorId, doctors]);

    const {
        currentToken,
        previousToken,
        waitingQueue,
        nextToken,
        upcomingTokens,
    } = useMemo(() => {
        if (!currentDisplayQueue) {
            return {
                currentToken: null,
                previousToken: null,
                waitingQueue: [],
                nextToken: null,
                upcomingTokens: [],
            };
        }
        const waiting = currentDisplayQueue.waiting || [];
        return {
            currentToken: currentDisplayQueue.active,
            previousToken: currentDisplayQueue.previous,
            waitingQueue: waiting,
            nextToken: waiting[0] || null,
            upcomingTokens: waiting.slice(1, 4),
        };
    }, [currentDisplayQueue]);

    const totalWaitingPatients = useMemo(() => {
        if (selectedDoctorId && currentDisplayQueue) {
            return currentDisplayQueue.waiting.length;
        }
        if (selectedDepartmentId && selectedDepartmentId !== "all") {
            return Object.values(queues)
                .filter((q) => q.departmentId === selectedDepartmentId)
                .reduce((acc, q) => acc + q.waiting.length, 0);
        }
        return Object.values(queues).reduce(
            (acc, q) => acc + q.waiting.length,
            0
        );
    }, [queues, selectedDepartmentId, selectedDoctorId, currentDisplayQueue]);

    // UI Helpers
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

    const selectedDeptDetails = departments.find(
        (d) => d.id === selectedDepartmentId
    );
    const selectedDoctorDetails = doctors.find(
        (d) => d.id === selectedDoctorId
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-y-auto">
            {/* Connection Error Banner */}
            {connectionError && (
                <div
                    className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r"
                    role="alert"
                >
                    <div className="flex items-center">
                        <AlertTriangle className="w-6 h-6 mr-2" />
                        <div>
                            <p className="font-bold">Connection Error</p>
                            <p className="text-sm">{connectionError}</p>
                        </div>
                        <button
                            onClick={fetchQueueData}
                            className="ml-auto text-red-700 hover:text-red-900"
                            title="Retry connection"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        /
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    <h1 className="text-5xl font-bold text-slate-800 mb-2">
                        Patient Queue Display
                    </h1>
                    <p className="text-2xl text-slate-600 mb-6">
                        Medical Center - Token Management System
                    </p>
                    {/* Filters */}
                    <div className="flex items-center space-x-4 mb-4">
                        <Building2 className="w-6 h-6 text-slate-600" />
                        <span className="text-xl font-medium text-slate-700">
                            Department:
                        </span>
                        <select
                            value={selectedDepartmentId || ""}
                            onChange={(e) => {
                                setSelectedDepartmentId(e.target.value);
                                setSelectedDoctorId(""); // Reset doctor on department change
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
                            value={selectedDoctorId || ""}
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
                            {isUpdating ? "Updating..." : "Call Next Token"}
                        </button>
                        <button
                            onClick={completeCurrentToken}
                            disabled={isUpdating || !currentToken}
                            className="mt-4 bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-2 rounded-xl font-medium text-lg border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUpdating ? "Updating..." : "Complete Current"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Queue Header */}
            <div
                className={`bg-gradient-to-r ${getDepartmentColor(
                    currentDisplayQueue?.departmentId || "default"
                )} text-white rounded-2xl p-6 mb-8 shadow-lg`}
            >
                <div className="flex items-center justify-center">
                    <Building2 className="w-8 h-8 mr-3" />
                    <h2 className="text-3xl font-bold truncate">
                        {selectedDoctorDetails?.fullName
                            ? `Dr. ${selectedDoctorDetails.fullName}`
                            : selectedDeptDetails?.name ||
                              "All Departments Overview"}
                    </h2>
                    <span className="ml-4 bg-white/20 px-4 py-2 rounded-full text-lg whitespace-nowrap">
                        {totalWaitingPatients} patients waiting
                    </span>
                </div>
            </div>

            {/* Main Display: Previous, Current, Next */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-center">
                {/* Previous Token */}
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
                                    title={currentDisplayQueue?.doctorName}
                                >
                                    {currentDisplayQueue?.doctorName}
                                </div>
                                <div
                                    className={`text-base font-medium flex items-center justify-center px-2 py-1 rounded-full mx-auto w-fit ${getPriorityClasses(
                                        previousToken.priority
                                    )}`}
                                >
                                    {getPriorityIcon(previousToken.priority)}
                                    {previousToken.priority}
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

                {/* Current Token */}
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-8 shadow-2xl transform lg:scale-110 h-[420px] flex flex-col">
                    <div className="text-center text-white flex-grow flex flex-col justify-center">
                        <h2 className="text-4xl font-semibold mb-8 flex items-center justify-center">
                            <Users className="w-10 h-10 mr-4" />
                            Now Serving
                        </h2>
                        {currentToken ? (
                            <>
                                <div className="text-3xl font-bold mb-6">
                                    #{currentToken.tokenValue}
                                </div>
                                <div
                                    className="text-3xl font-semibold truncate mb-4"
                                    title={currentDisplayQueue?.doctorName}
                                >
                                    {currentDisplayQueue?.doctorName}
                                </div>
                                <div className="text-3xl font-semibold truncate mb-4">
                                    {currentToken.patientName}
                                </div>
                                <div
                                    className={`bg-white/20 backdrop-blur-sm rounded-xl p-3 mb-4 flex items-center justify-center text-2xl font-medium ${getPriorityClasses(
                                        currentToken.priority
                                    )}`}
                                >
                                    {getPriorityIcon(currentToken.priority)}
                                    {currentToken.priority} Priority
                                </div>
                                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-xl font-medium">
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

                {/* Next Token */}
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
                                    title={currentDisplayQueue?.doctorName}
                                >
                                    {currentDisplayQueue?.doctorName}
                                </div>
                                <div
                                    className={`text-base font-medium flex items-center justify-center px-2 py-1 rounded-full mx-auto w-fit ${getPriorityClasses(
                                        nextToken.priority
                                    )}`}
                                >
                                    {getPriorityIcon(nextToken.priority)}
                                    {nextToken.priority}
                                </div>
                                <UpdatePriorityButton
                                    tokenId={nextToken.tokenId}
                                    priority={nextToken.priority}
                                    handleUpdatePriority={handleUpdatePriority}
                                    updatingPriorities={updatingPriorities}
                                />
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

            {/* Waiting Queue List */}
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
                                                currentDisplayQueue?.doctorName
                                            }
                                        >
                                            {currentDisplayQueue?.doctorName}
                                        </div>
                                        <div
                                            className={`text-xs font-medium flex items-center justify-center px-2 py-1 rounded-full mx-auto w-fit mb-1 ${getPriorityClasses(
                                                token.priority
                                            )}`}
                                        >
                                            {getPriorityIcon(token.priority)}
                                            {token.priority} Priority
                                        </div>
                                        <div className="flex space-x-1 mt-1 justify-center">
                                            <UpdatePriorityButton
                                                tokenId={token.tokenId}
                                                priority={token.priority}
                                                handleUpdatePriority={
                                                    handleUpdatePriority
                                                }
                                                updatingPriorities={
                                                    updatingPriorities
                                                }
                                            />
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

            {/* Footer */}
            <div className="mt-8 text-center">
                <div className="text-lg text-slate-500">
                    System Status: Online • Auto-refresh via SSE
                </div>
            </div>
        </div>
    );
};

export default React.memo(QueueDisplay);
