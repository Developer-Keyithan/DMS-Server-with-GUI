#!/bin/bash

set -e

VERSION=$1
ARCH=$2
PACKAGE_NAME="hexabase"
MAINTAINER="Hexabase Team <team@hexabase.io>"

echo "Creating DEB package for ${PACKAGE_NAME} ${VERSION} ${ARCH}"

# Create package structure
BUILD_DIR="dist/deb-build"
mkdir -p ${BUILD_DIR}/DEBIAN
mkdir -p ${BUILD_DIR}/usr/bin
mkdir -p ${BUILD_DIR}/usr/share/hexabase
mkdir -p ${BUILD_DIR}/usr/share/applications
mkdir -p ${BUILD_DIR}/usr/share/doc/hexabase
mkdir -p ${BUILD_DIR}/var/lib/hexabase
mkdir -p ${BUILD_DIR}/var/log/hexabase

# Copy files
cp -r hexabase/* ${BUILD_DIR}/usr/share/hexabase/
cp resources/icon.png ${BUILD_DIR}/usr/share/hexabase/
cp LICENSE ${BUILD_DIR}/usr/share/doc/hexabase/
cp README.md ${BUILD_DIR}/usr/share/doc/hexabase/

# Create control file
cat > ${BUILD_DIR}/DEBIAN/control << EOF
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Architecture: ${ARCH}
Maintainer: ${MAINTAINER}
Depends: nodejs (>= 16.0.0), npm
Recommends: curl, wget
Section: database
Priority: optional
Homepage: https://hexabase.io
Description: Local Database Management System with JSON and File Storage
 Hexabase is a self-contained, full-stack Local Database Management System (DMS)
 that runs without any third-party AI or external database integration.
 It supports two types of data storage systems:
  * JSON Object Storage - stores structured JSON documents
  * File Storage - stores and manages files with metadata
EOF

# Create desktop entry
cat > ${BUILD_DIR}/usr/share/applications/hexabase.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Hexabase
Comment=Database Management System
Exec=/usr/bin/hexabase gui
Icon=/usr/share/hexabase/icon.png
Terminal=false
StartupWMClass=Hexabase
Categories=Development;Database;
EOF

# Create postinst script
cat > ${BUILD_DIR}/DEBIAN/postinst << 'EOF'
#!/bin/bash

set -e

# Create symlink
ln -sf /usr/share/hexabase/bin/hexabase.js /usr/bin/hexabase

# Set permissions
chmod +x /usr/bin/hexabase
chmod +x /usr/share/hexabase/bin/hexabase.js

# Create data directories
mkdir -p /var/lib/hexabase/data
mkdir -p /var/lib/hexabase/backups
mkdir -p /var/log/hexabase

chown -R root:root /var/lib/hexabase
chown -R root:root /var/log/hexabase

# Update desktop database
update-desktop-database /usr/share/applications/

echo "Hexabase installed successfully!"
echo "Run 'hexabase --help' to get started."
EOF

chmod +x ${BUILD_DIR}/DEBIAN/postinst

# Create prerm script
cat > ${BUILD_DIR}/DEBIAN/prerm << 'EOF'
#!/bin/bash

set -e

# Remove symlink
rm -f /usr/bin/hexabase

# Stop service if running
systemctl stop hexabase 2>/dev/null || true
systemctl disable hexabase 2>/dev/null || true
EOF

chmod +x ${BUILD_DIR}/DEBIAN/prerm

# Build the package
dpkg-deb --build ${BUILD_DIR} "dist/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Clean up
rm -rf ${BUILD_DIR}

echo "DEB package created: dist/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"