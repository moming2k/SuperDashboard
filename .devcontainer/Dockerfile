# Use Python 3.11 as base image
FROM python:3.11-bullseye

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 20.x, GitHub CLI, and ngrok
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && curl -fsSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
    && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | tee /etc/apt/sources.list.d/ngrok.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    nodejs \
    git \
    gh \
    ngrok \
    curl \
    wget \
    vim \
    sudo \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN python --version && node --version && npm --version

# Create a non-root user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set up workspace
WORKDIR /workspace

# Change ownership of workspace
RUN chown -R $USERNAME:$USERNAME /workspace

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog

# Set the default user
USER $USERNAME

# Ensure .bashrc exists for vscode user
RUN touch /home/vscode/.bashrc

# Install Claude Code CLI as vscode user
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH for the vscode user
ENV PATH="/home/vscode/.local/bin:${PATH}"

# Install rm-safely for safer rm operations
RUN curl -fsSL https://raw.githubusercontent.com/zdk/rm-safely/main/rm-safely | bash -s install

# Ensure rm-safely hook is loaded in non-interactive shells
RUN echo '[ -f "$HOME/.rm-safely" ] && source "$HOME/.rm-safely"' >> /home/vscode/.bashrc

# Add claude command with dangerously-skip-permissions to bash history for quick access
RUN echo "claude --dangerously-skip-permissions" >> /home/vscode/.bash_history
