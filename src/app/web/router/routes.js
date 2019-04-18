import Home from '../components/page/Home.vue'
import Multiplayer from '../components/page/Multiplayer/Multiplayer.vue'
import Singleplayer from '../components/page/Singleplayer/Singleplayer.vue'

import Setup from '../components/page/Setup/Setup.vue'
import Game from '../components/Game.vue'

import Frontend from '../components/layout/Frontend.vue'

const routes = [
  { 
    path: '/', 
    component: Frontend,
    children: [
      { path: '/', component: Home },
      { name: 'multiplayer', path: '/multiplayer', component: Multiplayer },
      { name: 'singleplayer', path: '/singleplayer', component: Singleplayer },
      { name: 'setup', path: '/setup', component: Setup }
    ]
  },
  { 
    name: 'quake', 
    path: '/quake', 
    component: Game,
    props: true 
  },
]

export default routes