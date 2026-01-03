#!/bin/bash

# Name of the output zip
ZIP_NAME="xcountry-extension.zip"

# Files/Dirs to include
FILES="manifest.json background.js content.js styles.css countries.json icons"

# Create icons directory if it doesn't exist (placeholder check)
if [ ! -d "icons" ]; then
    echo "⚠️  'icons' directory missing. Run image generation or create it manually."
fi

# Clean old zip
rm -f "$ZIP_NAME"

# Create new zip
echo "📦 Zipping extension..."
zip -r "$ZIP_NAME" $FILES -x "*.DS_Store"

echo "✅ Created $ZIP_NAME"
echo "   Ready for upload to Chrome Web Store."









