import logo from './logo.svg';
import MultiSelect from './components/MultiSelect';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
          Big Bon Select
        </p>
        <p style={{ fontSize: '16px', marginBottom: '20px' }}>
          Тестовые значения от 1 до 1 000 000
        </p>
        <MultiSelect />
      </header>
    </div>
  );
}

export default App;
