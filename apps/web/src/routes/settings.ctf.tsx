import { createFileRoute } from "@tanstack/react-router";

import { CtfSettingsPanel } from "../components/settings/CtfSettingsPanel";

export const Route = createFileRoute("/settings/ctf")({
  component: CtfSettingsPanel,
});
