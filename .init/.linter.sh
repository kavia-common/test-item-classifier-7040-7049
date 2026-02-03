#!/bin/bash
cd /home/kavia/workspace/code-generation/test-item-classifier-7040-7049/test_item_classification_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

