import { useEffect, useState } from 'react';
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
      <div className='max-w-xl gap-6 mx-auto p-8 justify-center items-center min-h-screen flex flex-col '>
        <h2 className='text-2xl font-bold text-center mt-4 text-white  '>
          Proyecto en desarrollo, por favor espere...
        </h2>
        <main className='bg-white/15 text-white rounded-lg shadow-md p-6 mt-6 hover:bg-white/20 hover:translate-y-[-5px] transition'>
          {status === "loading" && <p className=' '>Cargando...</p> }
          {status === "Conectado exitosamente" && <p>Conectado exitosamente</p> }
          {status === "error" && <p>Error al conectar con el backend</p> }
          <h3>Respuesta del backend</h3>
        <pre>{JSON.stringify(data, null, 2)}</pre>
        </main>
      
      </div>
  
  );
}

export default App
