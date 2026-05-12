#!/usr/bin/env bash

# WA BOT PANEL PRO - Termux/Ubuntu friendly
# ASCII-only output to avoid broken characters on different terminals.

LOGIN_KEY="n"
APP_NAME="WA BOT PANEL PRO"
VERSION="v3.2 TERMUX UBUNTU"
DEVELOPER="Nyipto Nanda Dev"
UPDATE_REPO="https://github.com/bambank1/badak"

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
MULTI_DELAY_MIN=30
MULTI_DELAY_MAX=120
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

mask_repo_url() {
    url="$1"
    url="${url#https://github.com/}"
    owner="${url%%/*}"
    repo="${url#*/}"

    owner_mask="${owner:0:2}***${owner: -1}"
    repo_mask="${repo:0:2}***${repo: -1}"

    echo "https://github.com/${owner_mask}/${repo_mask}"
}
run_quiet() {
    "$@" >/dev/null 2>&1
}

normalize_file() {
    file="$1"
    [ -f "$file" ] || return 0

    if need_cmd sed; then
        sed -i 's/\r$//' "$file" 2>/dev/null || true
    else
        tmp_file="${file}.tmp"
        tr -d '\r' < "$file" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$file"
    fi
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
        echo "[2/5] Checking packages..."
        run_quiet pkg update -y
        need_cmd node || run_quiet pkg install nodejs-lts -y || run_quiet pkg install nodejs -y
        need_cmd git || run_quiet pkg install git -y
    elif need_cmd apt-get; then
        echo "[1/5] Environment : Ubuntu/Debian"
        echo "[2/5] Checking system packages..."
        need_cmd node || run_quiet apt_install nodejs npm
        need_cmd npm || run_quiet apt_install npm
        need_cmd git || run_quiet apt_install git
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
    if npm install @whiskeysockets/baileys pino qrcode-terminal --no-audit --no-fund --silent >/dev/null 2>&1; then
        echo "      Modules ready."
    else
        echo "FAILED: Module install failed."
        pause
        return 1
    fi

    echo "[5/5] Checking PM2..."
    if ! need_cmd pm2; then
        npm install -g pm2 --no-audit --no-fund --silent </dev/null >/dev/null 2>&1 || npm install pm2 --save-dev --no-audit --no-fund --silent </dev/null >/dev/null 2>&1
    fi

    echo ""
    echo "============================================================"
    echo "Install summary"
    echo "============================================================"
    echo "Node : $(node --version 2>/dev/null)"
    echo "npm  : $(npm --version 2>/dev/null)"

    if need_cmd pm2; then
        echo "PM2     : $(pm2 --version 2>/dev/null)"
    elif [ -x "./node_modules/.bin/pm2" ]; then
        echo "PM2     : local (use npx pm2)"
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
        echo -e "Session Gap: ${YELLOW}random ${MULTI_DELAY_MIN}-${MULTI_DELAY_MAX}s${NC}"
    else
        echo -e "Multi Mode : ${RED}OFF${NC}"
    fi

    echo ""
}

toggle_multi_mode() {
    if [ "$MULTI_MODE" -eq 0 ]; then
        read -r -p "Delay antar session minimum detik [30]: " min_gap
        read -r -p "Delay antar session maximum detik [120]: " max_gap

        min_gap=${min_gap:-30}
        max_gap=${max_gap:-120}

        case "$min_gap" in
            ''|*[!0-9]*)
                echo "Minimum delay harus angka."
                sleep 1
                return
                ;;
        esac

        case "$max_gap" in
            ''|*[!0-9]*)
                echo "Maximum delay harus angka."
                sleep 1
                return
                ;;
        esac

        if [ "$max_gap" -lt "$min_gap" ]; then
            echo "Maximum delay harus lebih besar atau sama dengan minimum."
            sleep 1
            return
        fi

        MULTI_DELAY_MIN="$min_gap"
        MULTI_DELAY_MAX="$max_gap"
        MULTI_MODE=1
        echo "Multi account: ON"
        echo "Delay antar session: random ${MULTI_DELAY_MIN}-${MULTI_DELAY_MAX} detik"
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

            if [ "$found" -gt 0 ]; then
                gap=$((RANDOM % (MULTI_DELAY_MAX - MULTI_DELAY_MIN + 1) + MULTI_DELAY_MIN))
                echo "Waiting ${gap}s before next session..."
                sleep "$gap"
            fi

            found=$((found + 1))
            echo "Starting: $akun"
            MULTI_RUN=1 RUN_FROM_SH=1 NODE_NO_WARNINGS=1 NODE_OPTIONS="--no-warnings" SESSION="$akun" node index.js &
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
        sleep 1
    fi
}

auto_loop() {
    read -r -p "Loop random minimum seconds: " min_d
    case "$min_d" in
        ''|*[!0-9]*)
            echo "Minimum delay must be a number."
            sleep 1
            return
            ;;
    esac

    read -r -p "Loop random maximum seconds: " max_d
    case "$max_d" in
        ''|*[!0-9]*)
            echo "Maximum delay must be a number."
            sleep 1
            return
            ;;
    esac

    if [ "$max_d" -lt "$min_d" ]; then
        echo "Maximum delay must be greater than or equal to minimum delay."
        sleep 1
        return
    fi

    clear
    echo "AUTO LOOP ACTIVE"
    echo "Delay: random ${min_d}-${max_d} seconds"
    echo "Loop berjalan di dalam koneksi bot, jadi tidak reconnect tiap putaran."
    echo ""

    export LOOP_MODE=1
    export LOOP_DELAY_MIN="$min_d"
    export LOOP_DELAY_MAX="$max_d"
    run_bot
    LOOP_MODE=0
    unset LOOP_DELAY_MIN
    unset LOOP_DELAY_MAX
}

view_nomor() {
    ensure_files
    echo "Target tersimpan:"
    echo "- Nomor: 628xxxx atau 08xxxx"
    echo "- Group: 1203xxxx@g.us"
    echo "  Catatan: setiap akun multi mode harus sudah join ke group target."
    echo ""
    cat nomor_wa.txt
    pause
}

tambah_nomor() {
    ensure_files
    read -r -p "Target number/group JID: " n
    if [ -n "$n" ]; then
        echo "$n" >> nomor_wa.txt
        echo "Target added."
    fi
    sleep 1
}

hapus_nomor() {
    ensure_files
    read -r -p "Delete target: " n
    if [ -z "$n" ]; then
        echo "Empty input."
        sleep 1
        return
    fi

    tmp_file="$(mktemp)"
    grep -Fv -- "$n" nomor_wa.txt > "$tmp_file" || true
    mv "$tmp_file" nomor_wa.txt
    echo "Target deleted if it existed."
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

update_script() {
    clear
    echo "============================================================"
    echo "                    UPDATE SCRIPT"
    echo "============================================================"
    cd "$SCRIPT_DIR" || return 1

    if ! need_cmd git; then
        echo "FAILED: git is not installed. Run AUTO INSTALLER first."
        pause
        return 1
    fi

    echo "[1/5] Source repo : $(mask_repo_url "$UPDATE_REPO")"
    update_tmp=".update_tmp_badak"
    rm -rf "$update_tmp"

    echo "[2/5] Downloading latest script..."
    if ! git clone --depth 1 "$UPDATE_REPO" "$update_tmp" >/dev/null 2>&1; then
        echo "FAILED: Cannot download update from GitHub."
        echo "Check internet connection or repo URL."
        rm -rf "$update_tmp"
        pause
        return 1
    fi

    echo "[3/5] Applying script files..."
    copied=0
    for file in bot.sh index.js auth.js config.js messages.js; do
        if [ -f "$update_tmp/$file" ]; then
            cp "$update_tmp/$file" "$file"
            normalize_file "$file"
            copied=$((copied + 1))
            echo "      updated: $file"
        fi
    done

    if [ "$copied" -eq 0 ]; then
        echo "FAILED: No known script files found in repo."
        rm -rf "$update_tmp"
        pause
        return 1
    fi

    rm -rf "$update_tmp"
    normalize_file bot.sh
    chmod +x bot.sh 2>/dev/null || true

    if ! need_cmd npm; then
        echo "FAILED: npm is not installed. Run AUTO INSTALLER first."
        pause
        return 1
    fi

    echo "[4/5] Updating bot modules..."
    if npm install @whiskeysockets/baileys@latest pino@latest qrcode-terminal@latest --no-audit --no-fund --silent >/dev/null 2>&1; then
        echo "      Modules updated."
    else
        echo "      Module update failed. Keeping current modules."
    fi

    echo "[5/5] Refreshing project settings..."
    npm pkg set main="index.js" type="commonjs" scripts.start="node index.js" >/dev/null 2>&1 || true

    echo ""
    echo "============================================================"
    echo "Update summary"
    echo "============================================================"
    echo "Version : $VERSION"
    echo "Repo    : $(mask_repo_url "$UPDATE_REPO")"
    echo "Files   : $copied updated"
    echo "Node    : $(node --version 2>/dev/null || echo '-')"
    echo "npm     : $(npm --version 2>/dev/null || echo '-')"
    if need_cmd pm2; then
        echo "PM2     : $(pm2 --version 2>/dev/null)"
    elif [ -x "./node_modules/.bin/pm2" ]; then
        echo "PM2     : local (use npx pm2)"
    else
        echo "PM2     : not installed"
    fi
    echo "Status: update complete"
    echo "Note  : sessions, logs, and nomor_wa.txt were not changed"
    pause
}
list_group() {
    ensure_files
    RUN_FROM_SH=1 NODE_NO_WARNINGS=1 NODE_OPTIONS="--no-warnings" LIST_GROUPS=1 SESSION="$SESSION" node index.js
    pause
}
open_qris_browser() {
    url="$1"

    if need_cmd termux-open-url; then
        termux-open-url "$url" >/dev/null 2>&1 && return 0
    fi

    if need_cmd xdg-open; then
        xdg-open "$url" >/dev/null 2>&1 && return 0
    fi

    if need_cmd sensible-browser; then
        sensible-browser "$url" >/dev/null 2>&1 && return 0
    fi

    if need_cmd wslview; then
        wslview "$url" >/dev/null 2>&1 && return 0
    fi

    return 1
}

donasi_qris() {
    qris_url="https://raw.githubusercontent.com/bambank1/Qris/refs/heads/main/IMG-20250506-WA0005.jpg"
    qris_file="qris_donasi.jpg"
    opened=0

    clear
    echo "============================================================"
    echo "                         DONASI QRIS                         "
    echo "============================================================"
    echo "Link QRIS: $qris_url"
    echo ""

    if need_cmd curl; then
        echo "Mengunduh gambar QRIS..."
        if curl -L --fail --silent --show-error "$qris_url" -o "$qris_file"; then
            echo "QRIS tersimpan: $qris_file"
            echo ""

            if need_cmd termux-open; then
                if termux-open "$qris_file" >/dev/null 2>&1; then
                    echo "Membuka gambar QRIS dengan Termux."
                    opened=1
                fi
            elif need_cmd xdg-open; then
                if xdg-open "$qris_file" >/dev/null 2>&1; then
                    echo "Membuka gambar QRIS dengan aplikasi gambar."
                    opened=1
                fi
            fi
        else
            echo "Gagal mengunduh QRIS."
        fi
    else
        echo "curl belum tersedia."
    fi

    if [ "$opened" -ne 1 ]; then
        echo "Gambar tidak terbuka otomatis. Mengalihkan ke browser..."
        if open_qris_browser "$qris_url"; then
            echo "Browser dibuka untuk menampilkan QRIS."
        else
            echo "Browser tidak tersedia. Buka link QRIS di atas secara manual."
        fi
    fi

    pause
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
    echo "[6]  VIEW TARGET"
    echo "[7]  TAMBAH TARGET"
    echo "[8]  HAPUS TARGET"
    echo "[9]  CLEAN DUPLIKAT"
    echo ""
    echo "[10] EDIT MESSAGE"
    echo "[11] EDIT CONFIG"
    echo "[12] EDIT TARGET"
    echo ""
    echo "[13] AUTO INSTALLER"
    echo "[14] UPDATE SCRIPT"
    echo "[15] LIST GROUP"
    echo "[16] DONASI QRIS"
    echo ""
    echo "[0]  EXIT"
    echo ""
    echo "Masukkan nomor menu, lalu tekan Enter."
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
        14) update_script ;;
        15) list_group ;;
        16) donasi_qris ;;
        0) exit 0 ;;
        *) echo "Invalid option."; sleep 1 ;;
    esac
done
