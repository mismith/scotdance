FROM typesense/typesense:0.23.1

WORKDIR /app

# Avoid running docker container as root
RUN adduser --system scotdance
RUN chown -R scotdance /app
USER scotdance

# Configure Typesense
ENV TYPESENSE_DATA_DIR=/app/typesense-data
ENV TYPESENSE_ENABLE_CORS=true
# ENV TYPESENSE_API_KEY is stored in Render.com env vars

EXPOSE 8108
