import logo from './logo.svg';
import './App.css';

import Chat, { Bubble, useMessages } from '@chatui/core';
import '@chatui/core/dist/index.css';
// https://github.com/alibaba/ChatUI
// https://chatui.io
// https://market.m.taobao.com/app/chatui/theme-builder/index.html

function App() {
  const { messages, appendMsg, setTyping } = useMessages([]);

  function handleSend(type, val) {
    if (type === 'text' && val.trim()) {
      appendMsg({
        type: 'text',
        content: {text: val},
        position: 'right',
      });

      setTyping(true);

      setTimeout(() => {
        appendMsg({
          type: 'text',
          content: { text : 'I\'m Awa' },
        });
      }, 1000);
    }
  }

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
      onSend={handleSend}
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
