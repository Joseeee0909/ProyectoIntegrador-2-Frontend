import { useEffect, useState } from 'react';
import './App.css';
import {ConnectToBackend} from './services/api';
import type { backendStatus, BackendResult } from "./services/api";

function App() {
  const [status, setStatus] = useState<backendStatus>("loading")
  const [data, setData] = useState<BackendResult["data"]>()

    useEffect(() => {
      ConnectToBackend().then((result) => {
        setStatus(result.status)
        setData(result.data)
      })
    }, [])

  return (
      <div>
        <h2>
          Proyecto en desarrollo, por favor espere...
        </h2>
        <main>
          {status === "loading" && <p>Cargando...</p> }
          {status === "Conectado exitosamente" && <p>Conectado exitosamente</p> }
          {status === "error" && <p>Error al conectar con el backend</p> }
          <h3>Respuesta del backend</h3>
        <pre>{JSON.stringify(data, null, 2)}</pre>
        </main>
      
      </div>
  
  );
}

export default App
