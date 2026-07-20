#!/usr/bin/env python3
"""Upload synoza-deploy.tar.gz and restart production app."""
import sys
import paramiko
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAR_PATH = ROOT / "deploy" / "synoza-deploy.tar.gz"
APP_DIR = "/home/adminanmkavps/synoza.anmka.com"

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> str:
    print(">>>", cmd)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-6000:])
    if err.strip():
        print("ERR:", err[-3000:])
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out


def main() -> None:
    if not TAR_PATH.exists():
        raise SystemExit(f"Missing package: {TAR_PATH}. Run: npm run deploy:package")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    remote_tar = "/tmp/synoza-deploy.tar.gz"
    print(f"Uploading {TAR_PATH} -> {remote_tar}")
    sftp.put(str(TAR_PATH), remote_tar)
    sftp.close()

    run(
        client,
        f"""
set -e
APP={APP_DIR}
mkdir -p "$APP"
cd "$APP"
if [ -f server/.env ]; then cp server/.env /tmp/synoza-server.env.bak; fi
# Preserve uploaded media outside the wiped app tree
mkdir -p /home/adminanmkavps/synoza-media/exam/cases
mkdir -p /home/adminanmkavps/synoza-media/knowledge
if [ -d "$APP/client/public/exam/cases" ]; then
  cp -an "$APP/client/public/exam/cases/." /home/adminanmkavps/synoza-media/exam/cases/ 2>/dev/null || true
fi
if [ -d "$APP/client/dist/exam/cases" ]; then
  cp -an "$APP/client/dist/exam/cases/." /home/adminanmkavps/synoza-media/exam/cases/ 2>/dev/null || true
fi
# Never delete /home/adminanmkavps/synoza-media
rm -rf client server deploy start.sh ecosystem.config.cjs 2>/dev/null || true
tar xzf {remote_tar} -C "$APP"
if [ -f /tmp/synoza-server.env.bak ]; then
  cp /tmp/synoza-server.env.bak server/.env
  grep -q '^EMAIL_SITE_URL=' server/.env || echo 'EMAIL_SITE_URL=https://medsynoza.com' >> server/.env
  grep -q '^CLIENT_URL=' server/.env || echo 'CLIENT_URL=https://medsynoza.com' >> server/.env
  grep -q '^SYNOZA_EXAM_MEDIA_ROOT=' server/.env || echo 'SYNOZA_EXAM_MEDIA_ROOT=/home/adminanmkavps/synoza-media/exam' >> server/.env
  grep -q '^SYNOZA_AI_KNOWLEDGE_ROOT=' server/.env || echo 'SYNOZA_AI_KNOWLEDGE_ROOT=/home/adminanmkavps/synoza-media/knowledge' >> server/.env
  sed -i 's|^CLIENT_URL=.*|CLIENT_URL=https://medsynoza.com|' server/.env
  sed -i 's|^EMAIL_SITE_URL=.*|EMAIL_SITE_URL=https://medsynoza.com|' server/.env
fi
cd "$APP/server"
export NODE_ENV=production
export SYNOZA_EXAM_MEDIA_ROOT=/home/adminanmkavps/synoza-media/exam
export SYNOZA_AI_KNOWLEDGE_ROOT=/home/adminanmkavps/synoza-media/knowledge
npm install --omit=dev
npm install prisma @prisma/client tsx --no-save
npx prisma generate
npx prisma db push
# Do NOT run seed on deploy — it can overwrite production cases.
# Do NOT use --accept-data-loss unless intentionally resetting schema.
cd "$APP"
# Ensure packaged seed media also available under persistent root
if [ -d "$APP/client/public/exam/cases" ]; then
  cp -an "$APP/client/public/exam/cases/." /home/adminanmkavps/synoza-media/exam/cases/ 2>/dev/null || true
fi
pm2 delete synoza 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
sleep 2
curl -s http://127.0.0.1:5099/api/ping || true
pm2 list | grep synoza || true
""",
    )

    client.close()
    print("Deploy completed.")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    main()
