npx ng build --configuration=production

sudo rsync -a --delete dist/*/browser/ /var/www/html/

sudo nginx -t && sudo systemctl reload nginx