# Gun Development Server

In development, to not use **Heroku Gun Relay**, you can use your own **Local Gun Relay**.

```
cd gun-dev-server && yarn && yarn install
```

You need to notify `awa` and `awa-web` that you're using a new **Relay**


```js
// ./src/gun/gun.js
// Change the gun relay endpoint
// Be sure to save it for future and to not commit the localhost relay endpoint
const gun = Gun('http://127.0.0.1:8080/gun');
```

## Behaviour

### `awa-web`

If you open your browser with `awa-web` connected to your **Local Gun Relay**, and used it previously with **Heroky Gun Relay**, your `browser` will upload its *cache* (you can see it in *Developer Tools > Storage > Local Storage > gun/*) to your **Local Gun Relay**.

So, you will see all conversation that didn't happen on this **Relay**. To start from a fresh new **Relay** with `awa-web`:

1. Start `awa-web`
2. Open `awa-web` in your browser, and delete *gun/ cache*
3. Be sure that `./gun-dev-server/radata` is empty
4. Start `gun-dev-server`

### `awa` *(mobile)*

You should not have this problem of *shared conversation between Relay* with awa Mobile. Indeed, in development , there is no data save on memory, so you start with a brand new *cache* at each reload *(that should be address in production by the way)*.