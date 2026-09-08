import type { AgentIdentity } from "@letra/types";
import { AvatarFallback, AvatarImage } from "./avatar";
import { AvatarWithStatus } from "./avatar-with-status";

export function AgentAvatar({ agent, size = "md" }: { agent: AgentIdentity; size?: "sm" | "md" | "lg" }) {
		const fallback = agent.avatar.type === "initials" ? agent.avatar.value : agent.avatar.value;
		return <AvatarWithStatus size={size} status={agent.status} aria-label={`${agent.displayName} (${agent.status})`} title={agent.displayName}>
			{agent.avatar.type === "image" ? <AvatarImage src={agent.avatar.value} alt={agent.displayName} /> : <AvatarFallback size={size} style={{ background: agent.color }}>{fallback}</AvatarFallback>}
		</AvatarWithStatus>;
}
