import os
from setuptools import setup, find_packages

setup(
    name="kvcachescope",
    version="0.1.0",
    description="Logical memory profiler, fragmentation analyzer, and failure defense system for PagedAttention engines (vLLM, SGLang).",
    long_description=open("README.md", "r", encoding="utf-8").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    author="Brian Munene",
    url="https://github.com/brian-mwirigi/kvcachescope",
    packages=find_packages(include=["backend", "backend.*"]),
    python_requires=">=3.9",
    install_requires=[
        "fastapi>=0.100.0",
        "uvicorn[standard]>=0.22.0",
        "pydantic>=2.0.0",
        "websockets>=11.0"
    ],
    extras_require={
        "vllm": ["vllm>=0.4.0", "torch>=2.1.0"],
        "dev": ["pytest>=7.0", "psutil>=5.9.0", "playwright>=1.40.0"]
    },
    entry_points={
        "console_scripts": [
            "kvcachescope=backend.ci_runner:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Intended Audience :: Developers",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: System :: Hardware :: Symmetric Multi-processing",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
