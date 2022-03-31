FROM public.ecr.aws/lambda/python:3.9

# Copy function code
COPY mapping/app.py ${LAMBDA_TASK_ROOT}/app.py
COPY ../helpers.py ${LAMBDA_TASK_ROOT}/helpers.py

# Install the function's dependencies using file requirements.txt
# from your project folder.

COPY requirements.txt .
RUN  pip3 install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "app.handler" ]