#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# 自动加载本地密钥
if [ -f .env.local ]; then
    set -a
    . ./.env.local
    set +a
fi

VENV_PYTHON="backend/.venv/bin/python3"
VENV_PIP="backend/.venv/bin/pip"
PIDFILE="logs/server.pid"
LOGFILE="logs/server.log"

setup() {
    echo "[1/3] 安装依赖..."
    if [ ! -d backend/.venv ]; then
        python3 -m venv backend/.venv
    fi
    $VENV_PIP install -q -r requirements.txt
    mkdir -p logs
}

run_tests() {
    echo "[2/3] 运行测试套件..."
    echo ""
    if PYTHONPATH=backend "$VENV_PYTHON" -m pytest backend/tests/ -v --tb=short --color=yes; then
        echo ""
        echo "[test] ✓ 全部测试通过"
        return 0
    else
        local exit_code=$?
        echo ""
        echo "[test] ✗ 测试失败 (exit code: $exit_code)，终止启动" >&2
        return $exit_code
    fi
}

preflight() {
    setup
    run_tests
}

wait_for_url() {
    local url="$1"
    for _ in $(seq 1 30); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    echo "启动超时: $url" >&2
    return 1
}

start_production() {
    preflight
    launch_production
}

launch_production() {
    kill_port_if_needed
    echo "[3/3] 启动服务 (后台模式)..."
    PYTHONPATH=backend nohup "$VENV_PYTHON" backend/app.py >> "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    wait_for_url "http://127.0.0.1:8731/api/health"
    echo "  服务已启动 PID: $(cat $PIDFILE)"
    echo "  访问: http://127.0.0.1:8731"
    echo "  日志: $LOGFILE"
}

start_debug() {
    preflight
    kill_port_if_needed
    echo "[3/3] 启动服务 (调试模式)..."
    echo "  访问: http://127.0.0.1:8731"
    echo "  按 Ctrl+C 停止"
    echo ""
    PYTHONPATH=backend "$VENV_PYTHON" backend/app.py
}

stop() {
    if [ -f "$PIDFILE" ]; then
        local pid
        pid=$(cat "$PIDFILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "正在停止服务 (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            for _ in $(seq 1 5); do
                if ! kill -0 "$pid" 2>/dev/null; then
                    break
                fi
                sleep 1
            done
            kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$PIDFILE"
        echo "  已停止"
    else
        echo "服务未运行"
    fi
}

status() {
    if [ -f "$PIDFILE" ]; then
        local pid
        pid=$(cat "$PIDFILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "运行中 (PID: $pid)"
            echo "访问: http://127.0.0.1:8731"
        else
            echo "已停止 (PID 文件残留)"
            rm -f "$PIDFILE"
        fi
    else
        echo "未运行"
    fi
}

kill_port_if_needed() {
    local port="${PORT:-8731}"
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "端口 $port 被 PID $pids 占用，正在释放..."
        kill -9 $pids 2>/dev/null || true
        sleep 0.5
    fi
}

# ─── 入口 ───

case "${1:-}" in
    start|production)
        start_production
        ;;
    debug)
        start_debug
        ;;
    stop)
        stop
        ;;
    restart)
        preflight
        stop
        sleep 1
        launch_production
        ;;
    test)
        setup
        run_tests
        ;;
    status)
        status
        ;;
    "")
        echo "用法: ./start.sh [命令]"
        echo ""
        echo "  start       先测试，再以生产模式启动 (后台)"
        echo "  debug       先测试，再以调试模式启动 (前台)"
        echo "  test        仅运行测试套件"
        echo "  stop        停止服务"
        echo "  restart     先测试，通过后重启"
        echo "  status      查看状态"
        exit 1
        ;;
    *)
        echo "未知命令: $1"
        exit 1
        ;;
esac
