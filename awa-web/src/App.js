// import logo from './logo.svg';
import './App.css';

import Chat, { Bubble } from '@chatui/core';
import '@chatui/core/dist/index.css';
// https://github.com/alibaba/ChatUI
// https://chatui.io
// https://market.m.taobao.com/app/chatui/theme-builder/index.html

import useMessages from './hooks/useMessages';

function App() {
  const { messages, handleMessage } = useMessages();

  function renderMessageContent(msg) {
    const { content } = msg;
    return <Bubble content={content.text} />;
  }

  
  return (
    <Chat
      locale='en-US'
      navbar={{ title: 'Awa Web' }}
      messages={messages}
      renderMessageContent={renderMessageContent}
      onSend={handleMessage}
      placeholder='Awa'
    />
  );
}

export default App;

/**
<div className="App">
  <header className="App-header">
    <img src={logo} className="App-logo" alt="logo" />
    <p>
      Edit <code>src/App.js</code> and save to reload.
    </p>
    <a
      className="App-link"
      href="https://reactjs.org"
      target="_blank"
      rel="noopener noreferrer"
    >
      Learn React
    </a>
  </header>
</div>
 */
