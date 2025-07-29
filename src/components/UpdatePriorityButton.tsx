interface UpdatePriorityButtonProps {
    tokenId: string;
    priority: "NORMAL" | "HIGH" | "EMERGENCY";
    handleUpdatePriority: (tokenId: string, action: "increase" | "decrease") => void;
    updatingPriorities: Record<string, boolean>;
}

const UpdatePriorityButton = ({ tokenId, priority, handleUpdatePriority, updatingPriorities }: UpdatePriorityButtonProps) => {
    return (
        <>
            <button
                onClick={() => handleUpdatePriority(tokenId, "decrease")}
                disabled={
                    updatingPriorities[tokenId] ||
                    priority === "NORMAL"
                }
                className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Decrease priority"
            >
                ▼
            </button>
            <button
                onClick={() => handleUpdatePriority(tokenId, "increase")}
                disabled={
                    updatingPriorities[tokenId] ||
                    priority === "EMERGENCY"
                }
                className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Increase priority"
            >
                ▲
            </button>
        </>
    );
};

export default UpdatePriorityButton;
