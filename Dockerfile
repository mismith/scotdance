FROM typesense/typesense:0.23.1

WORKDIR /app
RUN adduser --system scotdance
RUN chown -R scotdance /app
USER scotdance

RUN mkdir /app/typesense-data
ENV TYPESENSE_DATA_DIR=/app/typesense-data
ENV TYPESENSE_ENABLE_CORS=true
ENV TYPESENSE_API_KEY=xyz
EXPOSE 8108
