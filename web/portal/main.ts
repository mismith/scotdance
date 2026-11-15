import '../src/portal/main'
import favicon from '../public/img/favicon.svg?url'
const icon = document.createElement('link')
icon.rel = 'icon'
icon.type = 'image/svg+xml'
icon.href = favicon
document.head.append(icon)
