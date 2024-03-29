FROM typesense/typesense:0.23.1

WORKDIR /app

# Mogenius (wisely) doesn't allow running docker containers as root
RUN adduser --system scotdance
RUN chown -R scotdance /app
USER scotdance

# Configure Typesense
RUN mkdir /app/typesense-data
ENV TYPESENSE_DATA_DIR=/app/typesense-data
ENV TYPESENSE_ENABLE_CORS=true
# ENV TYPESENSE_API_KEY is stored in Mogenious env vars
EXPOSE 8108
