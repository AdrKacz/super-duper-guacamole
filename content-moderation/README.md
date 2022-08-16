# Content Moderation

Tools to help moderate content and user on Awa.

```sh
# ban user 1234 and 123
yarn main --ban 1234 --ban 123
yarn main -b 1234 -b 123

# unban user 1234 and 123
yarn main --unban 1234 --unban 123
yarn main -u 1234 -u 123

# ban user 1234 and 123, then unban user 123 and 234
yarn main -b 1234 -b 123 -u 123 -u 234
yarn main -u 234 -b 123 -u 123 -b 1234 # order doesn't matter
```
