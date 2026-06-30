# Guía Completa — Botanica Studio MX

## 1. COMPRAR EL DOMINIO

1. Entra a https://neubox.com/encuentra-tu-dominio
2. Busca: botanicastudio.mx
3. Si está disponible, cómpralo (~$129 MXN/año)
4. Guarda tu usuario y contraseña de Neubox

## 2. CREAR CUENTAS (GRATIS)

### GitHub (donde se guarda el código)
1. Ve a https://github.com y crea una cuenta
2. Guarda tu usuario y contraseña

### Vercel (donde se hospeda la página)
1. Ve a https://vercel.com
2. Clic en "Sign Up" > "Continue with GitHub"
3. Autoriza Vercel para conectar con tu GitHub

## 3. SUBIR EL PROYECTO

### Desde tu computadora:
1. Abre la Terminal (busca "Terminal" en Spotlight)
2. Escribe estos comandos uno por uno:

```
cd Desktop/botanicastudio
git init
git add .
git commit -m "Primera versión de Botanica Studio"
```

3. Ve a GitHub.com > botón "+" > "New Repository"
4. Nombre: botanicastudio
5. Clic en "Create Repository"
6. Copia los comandos que te da GitHub y pégalos en Terminal

### Conectar con Vercel:
1. Ve a vercel.com/new
2. Selecciona tu repositorio "botanicastudio"
3. Clic en "Deploy"
4. Tu página estará en: botanicastudio.vercel.app

## 4. CONECTAR TU DOMINIO

1. En Vercel, ve a tu proyecto > Settings > Domains
2. Escribe: botanicastudio.mx y clic en "Add"
3. Vercel te dará unos datos DNS (algo como: cname.vercel-dns.com)
4. Ve a tu panel de Neubox > DNS > agrega el registro que te dió Vercel
5. Espera 10-30 minutos y tu dominio estará conectado

## 5. CONFIGURAR MERCADOPAGO

1. Ve a https://mercadopago.com.mx y crea cuenta
2. Verifica tu identidad
3. Ve a mercadopago.com.mx/developers/panel/app
4. Copia tu "Public Key" y "Access Token"
5. En Vercel > Settings > Environment Variables:
   - Nombre: MP_ACCESS_TOKEN | Valor: tu access token
   - Nombre: SITE_URL | Valor: https://botanicastudio.mx
6. En el archivo index.html, cambia 'TU_PUBLIC_KEY_AQUI' por tu Public Key

## 6. CÓMO ACTUALIZAR PRODUCTOS E IMÁGENES

### Opción A: Desde GitHub (más fácil)
1. Ve a github.com/tu-usuario/botanicastudio
2. Clic en el archivo index.html
3. Clic en el lápiz (editar)
4. Busca la sección de productos y cambia lo que necesites
5. Clic en "Commit changes"
6. Vercel actualiza automáticamente en ~30 segundos

### Opción B: Desde tu computadora
1. Edita los archivos en tu computadora
2. Abre Terminal y escribe:
```
cd Desktop/botanicastudio
git add .
git commit -m "Actualización de productos"
git push
```
3. Vercel actualiza automáticamente

## 7. CÓMO CAMBIAR IMÁGENES DE PRODUCTOS

Las imágenes se guardan en la carpeta /images/ del proyecto.

### Para agregar una nueva imagen:
1. Nombra tu foto con un nombre simple sin espacios: ramo-rosas.jpg
2. Ponla en la carpeta images/
3. En el código, donde dice la URL de la imagen, cambia a: /images/ramo-rosas.jpg
4. Sube los cambios con git (ver paso 6)

### Tamaño recomendado:
- Productos: 600x600 pixeles
- Categorías: 400x530 pixeles
- Hero: 600x800 pixeles
- Instagram: 300x300 pixeles
- Formato: JPG (más ligero) o WebP (más moderno)

## 8. CÓMO AGREGAR UN NUEVO PRODUCTO

En el archivo index.html, busca "PRODUCTS DATA" y agrega uno nuevo siguiendo este formato:

{ id:13, name:"Nombre del Producto", cat:"ramos", desc:"Descripción corta del producto.", price:450, oldPrice:null, img:"/images/nombre-foto.jpg", badge:null, badgeText:null, rating:4.9, reviews:0, stock:null },

Categorías disponibles: ramos, arreglos, plantas, gifts

## CONTACTO DE SOPORTE

Si tienes dudas, puedes pedirle a Claude que te ayude con cualquier cambio.
Solo abre Claude Code y dile qué quieres modificar.
