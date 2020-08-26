docker rm -f $(docker ps -aq)
docker network prune -f
docker volume rm $(docker volume ls -qf dangling=true)
docker rmi -f $(docker images | grep evote | awk '{print $3}')
rm -rf ./channel-artifacts/*
rm -rf ./crypto-config/*
rm -rf ../server/wallet