export type ActorKind = "USER" | "SYSTEM";

export type CommandContext = {
  actorKind: ActorKind;
  actorProfileId: string | null;
  actorScope: string;
  idempotencyKey: string;
  correlationId: string;
};

export type CommandFailureCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "COMMITMENT_CONFLICT"
  | "NOT_FOUND"
  | "CONCURRENCY_CONFLICT";

export type CommandSuccess<T> = {
  ok: true;
  value: T;
  correlationId: string;
};

export type CommandFailure = {
  ok: false;
  code: CommandFailureCode;
  message: string;
  correlationId: string;
};
export type CommandResult<T> = CommandSuccess<T> | CommandFailure;

export type CommandEnvelope<TInput> = {
  context: CommandContext;
  input: TInput;
};

export interface CanonicalCommand<TInput, TOutput> {
  readonly name: string;
  execute(envelope: CommandEnvelope<TInput>): Promise<CommandResult<TOutput>>;
}

export function assertValidCommandContext(context: CommandContext): void {
  if (context.actorKind === "USER" && !context.actorProfileId) {
    throw new Error("USER_COMMAND_REQUIRES_PROFILE");
  }
  if (context.actorKind === "SYSTEM" && context.actorProfileId) {
    throw new Error("SYSTEM_COMMAND_MUST_NOT_IMPERSONATE_USER");
  }
  if (context.idempotencyKey.length < 8) {
    throw new Error("IDEMPOTENCY_KEY_TOO_SHORT");
  }
  if (!context.actorScope.trim() || !context.correlationId.trim()) {
    throw new Error("COMMAND_CONTEXT_INCOMPLETE");
  }
}
