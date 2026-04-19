#!/bin/bash

# =========================
# 🔐 LOGIN KEY
# =========================
LOGIN_KEY="mr01y"

clear
echo "🔐 LOGIN REQUIRED"
read -p "Masukkan key: " input

if [ "$input" != "$LOGIN_KEY" ]; then
    echo "❌ Key salah!"
    exit
fi

echo "✅ Akses diterima"
sleep 1

# =========================
# 🎨 COLOR
# =========================
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# =========================
# 📁 INIT
# =========================
mkdir -p sessions
touch nomor_wa.txt

SESSION=${SESSION:-default}
MULTI_MODE=0
LOOP_MODE=0

# =========================
# 🎛️ HEADER
# =========================
header() {
clear
echo -e "${GREEN}"
echo "██╗    ██╗ █████╗     ██████╗  ██████╗ ████████╗"
echo "██║    ██║██╔══██╗    ██╔══██╗██╔═══██╗╚══██╔══╝"
echo "██║ █╗ ██║███████║    ██████╔╝██║   ██║   ██║   "
echo "██║███╗██║██╔══██║    ██╔══██╗██║   ██║   ██║   "
echo "╚███╔███╔╝██║  ██║    ██████╔╝╚██████╔╝   ██║   "
echo " ╚══╝╚══╝ ╚═╝  ╚═╝    ╚═════╝  ╚═════╝    ╚═╝   "
echo -e "${NC}"

echo -e "${CYAN}⚡ WA BOT PANEL PRO ⚡${NC}"
echo -e "Akun Aktif : ${YELLOW}$SESSION${NC}"
echo -e "Developer  : ${GREEN}Nyipto Nanda Dev${NC}"
echo -e "Version    : ${CYAN}v3.0 PRO MAX${NC}"

if [ "$MULTI_MODE" -eq 1 ]; then
    echo -e "Multi Mode : ${GREEN}ON${NC}"
else
    echo -e "Multi Mode : ${RED}OFF${NC}"
fi

echo ""
}

# =========================
# 🔁 TOGGLE MULTI MODE
# =========================
toggle_multi_mode() {
if [ "$MULTI_MODE" -eq 0 ]; then
    MULTI_MODE=1
    echo "✅ Multi akun: ON"
else
    MULTI_MODE=0
    echo "❌ Multi akun: OFF"
fi
sleep 1
}

# =========================
# 👤 PILIH AKUN
# =========================
choose_account() {
echo ""
echo "📂 Daftar akun:"
ls sessions 2>/dev/null

echo ""
read -p "Nama akun: " name

if [ -z "$name" ]; then
    echo "❌ Nama tidak boleh kosong"
    sleep 1
    return
fi

SESSION="$name"
export SESSION="$SESSION"

mkdir -p "sessions/$SESSION"

echo "✅ Akun aktif: $SESSION"
sleep 1
}

# =========================
# 🧹 HAPUS SESSION
# =========================
clear_session() {
echo ""
echo "📂 Daftar session:"
ls sessions 2>/dev/null

echo ""
read -p "Nama session: " target

if [ -z "$target" ]; then
    echo "❌ Kosong"
    sleep 1
    return
fi

if [ "$target" == "all" ]; then
    rm -rf sessions/*
    echo "✅ Semua dihapus"
    sleep 1
    return
fi

if [ ! -d "sessions/$target" ]; then
    echo "❌ Tidak ditemukan"
    sleep 1
    return
fi

read -p "Yakin hapus? (y/n): " confirm

if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
    rm -rf "sessions/$target"
    echo "✅ Berhasil"
else
    echo "❌ Batal"
fi

sleep 1
}

# =========================
# 🚀 RUN BOT
# =========================
run_bot() {

if [ "$MULTI_MODE" -eq 1 ]; then
    echo "🚀 Multi akun aktif..."

    mapfile -t akun_list < <(ls sessions)

    for akun in "${akun_list[@]}"; do
        echo "▶ $akun"
        RUN_FROM_SH=1 SESSION=$akun node index.js &
        sleep $((RANDOM % 5 + 2))
    done

    wait
else
    RUN_FROM_SH=1 SESSION=$SESSION node index.js
fi

if [ "$LOOP_MODE" != "1" ]; then
    read -p "Enter..."
fi
}

# =========================
# 🔁 AUTO LOOP
# =========================
auto_loop() {
read -p "Delay loop (detik): " d

export LOOP_MODE=1

while true; do
    clear
    echo "🔁 AUTO LOOP AKTIF"
    echo "⏳ Delay: ${d} detik"
    echo ""

    run_bot

    echo ""
    echo "✅ Loop selesai, ulang lagi dalam ${d} detik..."
    sleep $d
done
}

# =========================
# 📞 NOMOR
# =========================
view_nomor() {
cat nomor_wa.txt
read -p "Enter..."
}

tambah_nomor() {
read -p "Nomor: " n
echo $n >> nomor_wa.txt
}

hapus_nomor() {
read -p "Hapus: " n
sed -i "/$n/d" nomor_wa.txt
}

clean_duplikat() {
sort -u nomor_wa.txt -o nomor_wa.txt
echo "✅ Duplikat dibersihkan"
sleep 1
}

# =========================
# ✏️ EDIT
# =========================
edit_message() { nano messages.js; }
edit_config() { nano config.js; }
edit_nomor() { nano nomor_wa.txt; }

# =========================
# MENU LOOP
# =========================
while true; do
header

echo "[1] RUN BOT"
echo "[2] AUTO LOOP"
echo "[3] PILIH AKUN"
echo "[4] CLEAR SESSION"
echo "[5] TOGGLE MULTI MODE"
echo ""
echo "[6] VIEW NOMOR"
echo "[7] TAMBAH NOMOR"
echo "[8] HAPUS NOMOR"
echo "[9] CLEAN DUPLIKAT"
echo ""
echo "[10] EDIT MESSAGE"
echo "[11] EDIT CONFIG"
echo "[12] EDIT NOMOR"
echo ""
echo "[0] EXIT"
echo ""

read -p ">> " pilih

case $pilih in
1)
    LOOP_MODE=0
    run_bot
    ;;
2)
    auto_loop
    ;;
3)
    choose_account
    ;;
4)
    clear_session
    ;;
5)
    toggle_multi_mode
    ;;
6)
    view_nomor
    ;;
7)
    tambah_nomor
    ;;
8)
    hapus_nomor
    ;;
9)
    clean_duplikat
    ;;
10)
    edit_message
    ;;
11)
    edit_config
    ;;
12)
    edit_nomor
    ;;
0)
    exit
    ;;
*)
    echo "❌ Salah"
    sleep 1
    ;;
esac

done
