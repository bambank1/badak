#!/usr/bin/env bash

# WA BOT PANEL PRO - Termux/Ubuntu friendly
# ASCII-only output to avoid broken characters on different terminals.

LOGIN_KEY="n"
APP_NAME="WA BOT PANEL PRO"
VERSION="v3.2 TERMUX UBUNTU"
DEVELOPER="Nyipto Nanda Dev"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || {
    echo "Failed to enter script folder: $SCRIPT_DIR"
    exit 1
}

export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SESSION=${SESSION:-default}
MULTI_MODE=0
LOOP_MODE=0

pause() {
    echo ""
    read -r -p "Press Enter to continue... " _
}

ensure_files() {
    mkdir -p sessions
    touch nomor_wa.txt
}

need_cmd() {
    command -v "$1" >/dev/null 2>&1
}

apt_install() {
    if [ "${EUID:-$(id -u)}" -eq 0 ]; then
        apt-get update -y
        apt-get install -y "$@"
    elif need_cmd sudo; then
        sudo apt-get update -y
        sudo apt-get install -y "$@"
    else
        echo "sudo not found. Run this installer as root, or install manually: $*"
        return 1
    fi
}

auto_install() {
    clear
    echo "============================================================"
    echo "                    AUTO INSTALLER"
    echo "============================================================"
    cd "$SCRIPT_DIR" || return 1

    if need_cmd pkg; then
        echo "[1/5] Environment : Termux"
        echo "[2/5] Updating packages..."
        pkg update -y >/dev/null && pkg upgrade -y >/dev/null
        need_cmd node || pkg install nodejs-lts -y >/dev/null || pkg install nodejs -y >/dev/null
        need_cmd git || pkg install git -y >/dev/null
    elif need_cmd apt-get; then
        echo "[1/5] Environment : Ubuntu/Debian"
        echo "[2/5] Checking system packages..."
        need_cmd node || apt_install nodejs npm >/dev/null
        need_cmd npm || apt_install npm >/dev/null
        need_cmd git || apt_install git >/dev/null
    else
        echo "[1/5] Environment : Unknown"
        echo "No pkg or apt-get found. Install Node.js and npm manually first."
    fi

    if ! need_cmd node; then
        echo "FAILED: Node.js is not installed."
        pause
        return 1
    fi

    if ! need_cmd npm; then
        echo "FAILED: npm is not installed."
        pause
        return 1
    fi

    echo "[3/5] Preparing project files..."
    ensure_files

    if [ ! -f package.json ]; then
        npm init -y >/dev/null 2>&1
    fi

    npm pkg set main="index.js" type="commonjs" scripts.start="node index.js" >/dev/null 2>&1 || true
    npm config set fund false >/dev/null 2>&1 || true
    npm config set audit false >/dev/null 2>&1 || true

    echo "[4/5] Installing bot modules..."
    if npm install @whiskeysockets/baileys pino qrcode-terminal --no-audit --no-fund --silent; then
        echo "      Modules ready."
    else
        echo "FAILED: Module install failed."
        pause
        return 1
    fi

    echo "[5/5] Checking PM2..."
    if ! need_cmd pm2; then
        npm install -g pm2 --no-audit --no-fund --silent </dev/null || npm install pm2 --save-dev --no-audit --no-fund --silent </dev/null
    fi

    echo ""
    echo "============================================================"
    echo "Install summary"
    echo "============================================================"
    echo "Node : $(node --version 2>/dev/null)"
    echo "npm  : $(npm --version 2>/dev/null)"

    if need_cmd pm2; then
        echo "PM2  : $(pm2 --version 2>/dev/null)"
    elif [ -x "./node_modules/.bin/pm2" ]; then
        echo "PM2  : local (use npx pm2)"
    else
        echo "PM2  : not installed, RUN BOT can still use node"
    fi

    echo "Bot modules: ready"
    echo "Status     : complete"
    pause
}

login_gate() {
    clear
    echo "LOGIN REQUIRED"
    read -r -p "Enter key: " input

    if [ "$input" != "$LOGIN_KEY" ]; then
        echo "Wrong key."
        exit 1
    fi

    echo "Access granted."
    sleep 1
}

header() {
    clear
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}                    WA BOT PANEL PRO                       ${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo -e "App        : ${CYAN}$APP_NAME${NC}"
    echo -e "Account    : ${YELLOW}$SESSION${NC}"
    echo -e "Developer  : ${GREEN}$DEVELOPER${NC}"
    echo -e "Version    : ${CYAN}$VERSION${NC}"

    if [ "$MULTI_MODE" -eq 1 ]; then
        echo -e "Multi Mode : ${GREEN}ON${NC}"
    else
        echo -e "Multi Mode : ${RED}OFF${NC}"
    fi

    echo ""
}

toggle_multi_mode() {
    if [ "$MULTI_MODE" -eq 0 ]; then
        MULTI_MODE=1
        echo "Multi account: ON"
    else
        MULTI_MODE=0
        echo "Multi account: OFF"
    fi
    sleep 1
}

choose_account() {
    ensure_files
    echo ""
    echo "Account list:"
    find sessions -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null || ls sessions 2>/dev/null

    echo ""
    read -r -p "Account name: " name

    if [ -z "$name" ]; then
        echo "Name cannot be empty."
        sleep 1
        return
    fi

    SESSION="$name"
    export SESSION
    mkdir -p "sessions/$SESSION"

    echo "Active account: $SESSION"
    sleep 1
}

clear_session() {
    ensure_files
    echo ""
    echo "Session list:"
    find sessions -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null || ls sessions 2>/dev/null

    echo ""
    read -r -p "Session name (or all): " target

    if [ -z "$target" ]; then
        echo "Empty input."
        sleep 1
        return
    fi

    if [ "$target" = "all" ]; then
        read -r -p "Delete ALL sessions? (y/n): " confirm_all
        if [ "$confirm_all" = "y" ] || [ "$confirm_all" = "Y" ]; then
            rm -rf sessions/*
            echo "All sessions deleted."
        else
            echo "Cancelled."
        fi
        sleep 1
        return
    fi

    if [ ! -d "sessions/$target" ]; then
        echo "Session not found."
        sleep 1
        return
    fi

    read -r -p "Delete session '$target'? (y/n): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        rm -rf "sessions/$target"
        echo "Session deleted."
    else
        echo "Cancelled."
    fi

    sleep 1
}

run_one_bot() {
    RUN_FROM_SH=1 NODE_NO_WARNINGS=1 NODE_OPTIONS="--no-warnings" SESSION="$1" node index.js
}

run_bot() {
    ensure_files

    if ! need_cmd node; then
        echo "Node.js not found. Run AUTO INSTALLER first."
        pause
        return
    fi

    if [ ! -f index.js ]; then
        echo "index.js not found in: $SCRIPT_DIR"
        pause
        return
    fi

    if [ "$MULTI_MODE" -eq 1 ]; then
        echo "Multi account mode active..."
        found=0

        for dir in sessions/*; do
            [ -d "$dir" ] || continue
            akun="$(basename "$dir")"
            found=1
            echo "Starting: $akun"
            RUN_FROM_SH=1 NODE_NO_WARNINGS=1 NODE_OPTIONS="--no-warnings" SESSION="$akun" node index.js &
            sleep $((RANDOM % 5 + 2))
        done

        if [ "$found" -eq 0 ]; then
            echo "No session found. Create/select an account first."
            sleep 1
            return
        fi

        wait
    else
        run_one_bot "$SESSION"
    fi

    if [ "$LOOP_MODE" != "1" ]; then
        pause
    fi
}

auto_loop() {
    read -r -p "Loop delay in seconds: " d
    case "$d" in
        ''|*[!0-9]*)
            echo "Delay must be a number."
            sleep 1
            return
            ;;
    esac

    clear
    echo "AUTO LOOP ACTIVE"
    echo "Delay: ${d} seconds"
    echo "Loop berjalan di dalam koneksi bot, jadi tidak reconnect tiap putaran."
    echo ""

    export LOOP_MODE=1
    export LOOP_DELAY="$d"
    run_bot
    LOOP_MODE=0
    unset LOOP_DELAY
}

view_nomor() {
    ensure_files
    cat nomor_wa.txt
    pause
}

tambah_nomor() {
    ensure_files
    read -r -p "Number: " n
    if [ -n "$n" ]; then
        echo "$n" >> nomor_wa.txt
        echo "Number added."
    fi
    sleep 1
}

hapus_nomor() {
    ensure_files
    read -r -p "Delete number: " n
    if [ -z "$n" ]; then
        echo "Empty input."
        sleep 1
        return
    fi

    tmp_file="$(mktemp)"
    grep -Fv -- "$n" nomor_wa.txt > "$tmp_file" || true
    mv "$tmp_file" nomor_wa.txt
    echo "Number deleted if it existed."
    sleep 1
}

clean_duplikat() {
    ensure_files
    sort -u nomor_wa.txt -o nomor_wa.txt
    echo "Duplicates cleaned."
    sleep 1
}

edit_file() {
    file="$1"
    if need_cmd nano; then
        nano "$file"
    elif need_cmd vi; then
        vi "$file"
    else
        echo "No editor found. Install nano or vi."
        pause
    fi
}

edit_message() { edit_file messages.js; }
edit_config() { edit_file config.js; }
edit_nomor() { ensure_files; edit_file nomor_wa.txt; }

show_menu() {
    echo "[1]  RUN BOT"
    echo "[2]  AUTO LOOP"
    echo "[3]  PILIH AKUN"
    echo "[4]  CLEAR SESSION"
    echo "[5]  TOGGLE MULTI MODE"
    echo ""
    echo "[6]  VIEW NOMOR"
    echo "[7]  TAMBAH NOMOR"
    echo "[8]  HAPUS NOMOR"
    echo "[9]  CLEAN DUPLIKAT"
    echo ""
    echo "[10] EDIT MESSAGE"
    echo "[11] EDIT CONFIG"
    echo "[12] EDIT NOMOR"
    echo ""
    echo "[13] AUTO INSTALLER"
    echo ""
    echo "[0]  EXIT"
    echo ""
}

login_gate
ensure_files

while true; do
    header
    show_menu
    read -r -p ">> " pilih

    case "$pilih" in
        1) LOOP_MODE=0; run_bot ;;
        2) auto_loop ;;
        3) choose_account ;;
        4) clear_session ;;
        5) toggle_multi_mode ;;
        6) view_nomor ;;
        7) tambah_nomor ;;
        8) hapus_nomor ;;
        9) clean_duplikat ;;
        10) edit_message ;;
        11) edit_config ;;
        12) edit_nomor ;;
        13) auto_install ;;
        0) exit 0 ;;
        *) echo "Invalid option."; sleep 1 ;;
    esac
done