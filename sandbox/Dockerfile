# syntax=docker/dockerfile:1
# Build for linux/amd64 and linux/arm64:
#   docker buildx build --platform linux/amd64,linux/arm64 -t flagcode/ctf-sandbox:latest .
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Networking
    ncat \
    curl \
    wget \
    nmap \
    socat \
    # Binary analysis
    binutils \
    file \
    xxd \
    binwalk \
    gdb \
    ltrace \
    strace \
    # Forensics
    foremost \
    sleuthkit \
    # Steganography
    steghide \
    exiftool \
    # Crypto
    openssl \
    # Build tools
    gcc \
    g++ \
    cmake \
    make \
    git \
    patch \
    pkg-config \
    python3 \
    python3-pip \
    python3-dev \
    ruby \
    # pwntools system dependencies
    libffi-dev \
    libssl-dev \
    # gmpy2 build dependencies (needed when no prebuilt wheel exists)
    libgmp-dev \
    libmpfr-dev \
    libmpc-dev \
    # Misc utilities
    netcat-openbsd \
    unzip \
    zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install radare2 from source (not in Ubuntu 22.04 repos).
# --install: real file copy (not symlinks, which would break after rm).
# --without-pull: skip redundant git pull during Docker build.
RUN git clone --depth=1 https://github.com/radareorg/radare2.git /tmp/radare2 \
    && cd /tmp/radare2 \
    && sys/install.sh --install --without-pull \
    && cd / \
    && rm -rf /tmp/radare2

# Install uv (fast Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Upgrade pip and setuptools (Ubuntu 22.04 ships setuptools 59.x;
# z3-solver needs setuptools >= 62.4 for setuptools.command.build).
RUN pip3 install --no-cache-dir --upgrade pip "setuptools>=69.0" wheel

# Install Python CTF libraries.
# Note: z3-solver has no prebuilt aarch64 wheel and compiles from source (~10 min).
# checksec.py is the standalone checksec tool (pwntools also bundles one).
RUN pip3 install --no-cache-dir \
    pwntools \
    pycryptodome \
    gmpy2 \
    sympy \
    angr \
    ROPgadget \
    z3-solver \
    checksec.py

# Install RsaCtfTool.
# Its requirements.txt pins old conflicting versions (cryptography==39,
# requests==2.25, gmpy2==2.2.1, etc.) that clash with pwntools/angr.
# We already have the core deps (gmpy2, pycryptodome, z3-solver, requests,
# cryptography, sympy, six); just install the missing ones loosely.
RUN git clone --depth=1 https://github.com/RsaCtfTool/RsaCtfTool.git /opt/RsaCtfTool \
    && pip3 install --no-cache-dir tqdm factordb-pycli \
    && ln -s /opt/RsaCtfTool/RsaCtfTool.py /usr/local/bin/RsaCtfTool

# Write a manifest of installed tools
RUN echo "flagcode/ctf-sandbox installed tools:" > /tools.txt \
    && echo "" >> /tools.txt \
    && echo "Networking: ncat, curl, wget, nmap, socat" >> /tools.txt \
    && echo "Binary analysis: binutils, file, xxd, binwalk, gdb, ltrace, strace, radare2, checksec" >> /tools.txt \
    && echo "Crypto: openssl" >> /tools.txt \
    && echo "Python CTF libs: pwntools, pycryptodome, gmpy2, sympy, angr, ROPgadget, z3-solver, RsaCtfTool" >> /tools.txt \
    && echo "Steganography: steghide, exiftool" >> /tools.txt \
    && echo "Forensics: binwalk, foremost, sleuthkit" >> /tools.txt \
    && echo "Build tools: gcc, g++, cmake, make, git, python3, python3-pip, ruby, uv" >> /tools.txt

WORKDIR /workspace
