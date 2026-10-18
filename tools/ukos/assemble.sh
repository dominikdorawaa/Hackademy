set -eu
mkdir -p /out /staging
cp /boot/vmlinuz-virt /out/kernel.bin
apk info -v > /out/packages.txt
cp -a /bin /etc /lib /sbin /usr /var /root /home /staging/
rm -rf /staging/lib/modules /staging/usr/share/man /staging/usr/share/doc /staging/var/cache/apk
mkdir -p /staging/dev /staging/proc /staging/sys /staging/run /staging/tmp /staging/usr/local/bin
chmod 1777 /staging/tmp
cp /ukos/init /staging/init
cp /ukos/control /staging/usr/local/bin/ukos-control
cp /ukos/bashrc /staging/home/student/.bashrc
cp /ukos/profile /staging/home/student/.bash_profile
chmod +x /staging/init /staging/usr/local/bin/ukos-control
chown -R 1000:1000 /staging/home/student
cd /staging
find . -print0 | cpio --null -o -H newc | gzip -9n > /out/initrd.gz
