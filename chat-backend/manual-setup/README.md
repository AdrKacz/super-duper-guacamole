# Manual setup

> Don't forget to install dependencies with `yarn`.

## Create backend authentication key

```
yarn node generate-jwk.js your-key
```

1. It will update `chat-backend/.well-known/jwks.json` with new public key.
2. It will print in the terminal the private key, copy it and create a secret in AWS to use it later.
    1. Open **Parameter Store**, and create your new parameter to hold your private key.
    2. When you run `sam`, update **AuthenticationStage** with the name of your new key

## Create an user

```
sh create-user-key-pair.sh
yarn node sign-up-user.js your-id
yarn node sign-in-user.js your-id
```

You will receive an **JWT** that you can use to authenticate your queries to the backend.