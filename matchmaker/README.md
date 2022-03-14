# Matchmaker

The **matchmaker** is a *Lambda* function that creates rooms for users.

Users have to send their preference (coming from the **recommender system**), and the **matchmaker** try to satisfy as many users as possible.

We already have a *Lightsail* instance running in the cloud. For simplicity, we will not use *Lambda* for now. The **matchmaker** will communicate with the **fleet manager** through an open port, both on the same machine.

# Development

```sh
cd matchmaker
docker build -t <your-image> .
docker run -dp <your-port>:8080 <your-image>
# Go to http://localhost:<your-port>/docs to test your API
```

# Upload to DockerHub

1. Sign in [Docker Hub](https://hub.docker.com)
2. Click on **Create Repository**
3. Login with the CLI: `docker login -u <your-username>`
4. Build your image: `docker build -t <your-username>/<your-repository>`
5. Push your image: `docker push <your-username>/<your-repository>`

# Upload to AWS Lightsail

Simply use your image in **DockerHub** in your *AWS Lightsail* instance. Don't forget to open a port in your *AWS Lightsail Networking* section.

### Error

`host.docker.internal` cannot be reached from within docker container on Amazon Linux 2
