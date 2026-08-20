FROM ubuntu:24.04 AS lean-builder

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git build-essential \
    && rm -rf /var/lib/apt/lists/*
ENV ELAN_HOME=/opt/elan
ENV PATH=/opt/elan/bin:${PATH}
RUN curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
    | sh -s -- -y --default-toolchain none

WORKDIR /src/lean
COPY lean/lean-toolchain lean/lakefile.lean lean/lake-manifest.json ./
COPY lean/Imba.lean lean/Main.lean ./
COPY lean/Imba ./Imba
RUN lake build

FROM ubuntu:24.04 AS runtime

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 python3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 imba

WORKDIR /opt/imba
COPY --from=lean-builder /src/lean/.lake/build/bin/imba-core /opt/imba/bin/imba-core
COPY python /opt/imba/python
RUN chown -R imba:imba /opt/imba

USER imba
ENV HOST=0.0.0.0 \
    PORT=8765 \
    PYTHONPATH=/opt/imba/python \
    IMBA_CORE=/opt/imba/bin/imba-core \
    IMBA_COOKIE_SECURE=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import json,os,urllib.request; port=os.environ.get('PORT','8765'); assert json.load(urllib.request.urlopen('http://127.0.0.1:'+port+'/api/health', timeout=3))['ok']"
CMD ["python3", "-m", "imba.web"]
