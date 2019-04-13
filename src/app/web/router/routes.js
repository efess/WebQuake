import Home from '../components/page/Home.vue'
import Multiplayer from '../components/page/Multiplayer/Multiplayer.vue'
import Singleplayer from '../components/page/Singleplayer/Singleplayer.vue'

import SetupGame from '../components/page/SetupGame/SetupGame.vue'
import Game from '../components/Game.vue'

import Frontend from '../components/layout/Frontend.vue'

const routes = [
  { 
    path: '/', 
    component: Frontend,
    children: [
      { path: '/', component: Home },
      { name: 'multiplayer', path: '/multiplier', component: Multiplayer },
      { name: 'singleplayer', path: '/singleplayer', component: Singleplayer },
      { name: 'setup', path: '/setup', component: SetupGame }
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