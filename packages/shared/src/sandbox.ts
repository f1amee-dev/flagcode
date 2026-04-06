/** Sandbox image constants and instruction builder. */

export const SANDBOX_IMAGE_NAME = "flagcode/ctf-sandbox";
export const SANDBOX_IMAGE_TAG = "latest";

/**
 * Returns the Docker bridge host address for reaching host services from within a container.
 * We always pass --add-host host.docker.internal:host-gateway so it works on Linux too.
 */
export function resolveDockerBridgeHost(_platform: NodeJS.Platform): string {
  return "host.docker.internal";
}

/**
 * Builds the agent instructions block for using the CTF sandbox.
 * containerId and bridgeHost are embedded so the agent knows exactly how to use the sandbox.
 */
export function buildSandboxInstructions(containerId: string, bridgeHost: string): string {
  return `<sandbox_environment>
# Docker CTF Sandbox

You have access to a pre-configured CTF Docker sandbox container. Use it for all tool execution, binary analysis, and exploit development.

## Container Details

- **Container ID**: ${containerId}
- **Bridge Host** (to reach host services): ${bridgeHost}

## How to Run Commands in the Sandbox

A helper script \`sb\` is available in the workspace. Use it to run any command inside the sandbox:

\`\`\`bash
sb <command>
# Example:
sb python3 exploit.py
sb gdb ./binary
sb checksec ./binary
\`\`\`

Alternatively, you can use Docker directly:
\`\`\`bash
docker exec -i ${containerId} bash -c "<command>"
\`\`\`

## Available Tools

- **Networking**: ncat, curl, wget, nmap, socat
- **Binary Analysis**: binutils, file, xxd, binwalk, gdb, ltrace, strace, radare2, checksec
- **Python CTF Libraries**: pwntools, pycryptodome, gmpy2, sympy, angr, ROPgadget, z3-solver, RsaCtfTool
- **Steganography**: steghide, exiftool
- **Forensics**: binwalk, foremost, sleuthkit
- **Crypto**: openssl
- **Build Tools**: gcc, g++, cmake, make, python3, ruby, uv

## Workspace

The current workspace directory is mounted at \`/workspace\` inside the container. Files you place in the workspace are accessible inside the container and vice versa.

## Reaching Host Services

To connect to services running on the host machine from within the sandbox, use:
- Host: \`${bridgeHost}\`
- Example: \`sb curl http://${bridgeHost}:8080/\`

## Important Notes

- Run all exploits, binary analysis, and network tools inside the sandbox using \`sb\`
- The container has SYS_PTRACE capability and seccomp disabled for full debugging support
- Memory limit: 8GB, CPU limit: 2 cores
</sandbox_environment>`;
}
