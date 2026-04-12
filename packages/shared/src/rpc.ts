/**
 * Re-export all RPC definitions from contracts.
 *
 * This module exists so that consumers that historically imported from
 * `@flagcode/shared/rpc` continue to work without changes.  The canonical
 * definitions now live in `@flagcode/contracts`.
 */
export {
  WS_METHODS,
  WsGitCheckoutRpc,
  WsGitCreateBranchRpc,
  WsGitCreateWorktreeRpc,
  WsGitInitRpc,
  WsGitListBranchesRpc,
  WsGitPreparePullRequestThreadRpc,
  WsGitPullRpc,
  WsGitRefreshStatusRpc,
  WsGitRemoveWorktreeRpc,
  WsGitResolvePullRequestRpc,
  WsGitRunStackedActionRpc,
  WsOrchestrationDispatchCommandRpc,
  WsOrchestrationGetFullThreadDiffRpc,
  WsOrchestrationGetSnapshotRpc,
  WsOrchestrationGetTurnDiffRpc,
  WsOrchestrationReplayEventsRpc,
  WsProjectsSearchEntriesRpc,
  WsProjectsWriteFileRpc,
  WsRpcGroup,
  WsServerGetConfigRpc,
  WsServerGetSettingsRpc,
  WsServerRefreshProvidersRpc,
  WsServerUpdateSettingsRpc,
  WsServerUpsertKeybindingRpc,
  WsShellOpenInEditorRpc,
  WsSubscribeAuthAccessRpc,
  WsSubscribeGitStatusRpc,
  WsSubscribeOrchestrationDomainEventsRpc,
  WsSubscribeServerConfigRpc,
  WsSubscribeServerLifecycleRpc,
  WsSubscribeTerminalEventsRpc,
  WsTerminalClearRpc,
  WsTerminalCloseRpc,
  WsTerminalOpenRpc,
  WsTerminalResizeRpc,
  WsTerminalRestartRpc,
  WsTerminalWriteRpc,
  WsWriteupGenerateRpc,
} from "@flagcode/contracts";
