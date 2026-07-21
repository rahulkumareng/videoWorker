Useful commands

View live logs:

journalctl -u video-worker -f

Restart after code changes:

sudo systemctl restart video-worker

Stop the service:

sudo systemctl stop video-worker

Start it again:

sudo systemctl start video-worker

Check status:

sudo systemctl status video-worker