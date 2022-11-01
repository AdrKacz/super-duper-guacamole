openssl genrsa -out ./private.key 4096
openssl rsa -in private.key -pubout -outform PEM -out public.key