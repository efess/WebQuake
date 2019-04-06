import Vue from 'vue'
import App from './components/App.vue'
import store from './store'
import './scss/style.scss'

/* eslint-disable no-new */
new Vue({
  el: '#app',
  render: h => h(App),
  store
})
