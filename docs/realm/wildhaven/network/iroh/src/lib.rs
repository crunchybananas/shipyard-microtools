//! Bounded, memory-only observation transport. No town data is persisted here.
use std::{cell::{Cell, RefCell}, collections::HashMap, rc::Rc, time::Duration};
use iroh::{Endpoint, endpoint::{Connection, presets::N0}};
use iroh_tickets::endpoint::EndpointTicket;
use wasm_bindgen::{prelude::*, JsError};
use wasm_bindgen_futures::spawn_local;
const ALPN: &[u8] = b"realm/observe/1";
const MAX_REQUEST: usize = 4096;
const MAX_REPLY: usize = 262144;
const MAX_CONNECTIONS: usize = 8;
fn error(e: impl std::fmt::Display) -> JsError { JsError::new(&e.to_string()) }

#[wasm_bindgen]
pub struct TownPeer {
    endpoint: Endpoint,
    outgoing: Rc<RefCell<HashMap<String, Connection>>>,
}
#[wasm_bindgen]
impl TownPeer {
    pub async fn open(handler: js_sys::Function) -> Result<TownPeer, JsError> {
        console_error_panic_hook::set_once();
        let endpoint = Endpoint::builder(N0).alpns(vec![ALPN.to_vec()]).bind().await.map_err(error)?;
        let accept = endpoint.clone();
        let active = Rc::new(Cell::new(0usize));
        spawn_local(async move {
            while let Some(incoming) = accept.accept().await {
                if active.get() >= MAX_CONNECTIONS { incoming.refuse(); continue; }
                active.set(active.get()+1);
                let active = active.clone(); let handler = handler.clone();
                spawn_local(async move {
                    if let Ok(Ok(connection)) = n0_future::time::timeout(Duration::from_secs(12), incoming).await {
                        loop {
                            let Ok(Ok((mut send, mut recv))) = n0_future::time::timeout(Duration::from_secs(15), connection.accept_bi()).await else { break; };
                            let Ok(Ok(bytes)) = n0_future::time::timeout(Duration::from_secs(5), recv.read_to_end(MAX_REQUEST)).await else { break; };
                            let Ok(text) = String::from_utf8(bytes) else { break; };
                            // The peer identity comes from authenticated QUIC, never from JSON.
                            let reply = handler.call2(&JsValue::NULL, &JsValue::from_str(&connection.remote_id().to_string()), &JsValue::from_str(&text));
                            let Some(reply) = reply.ok().and_then(|v|v.as_string()).filter(|s|s.len() <= MAX_REPLY) else { break; };
                            if !matches!(n0_future::time::timeout(Duration::from_secs(5), send.write_all(reply.as_bytes())).await, Ok(Ok(()))) { break; }
                            if send.finish().is_err() { break; }
                        }
                        connection.close(0u8.into(), b"visit ended");
                    }
                    active.set(active.get().saturating_sub(1));
                });
            }
        });
        Ok(Self { endpoint, outgoing: Rc::new(RefCell::new(HashMap::new())) })
    }
    pub fn id(&self) -> String { self.endpoint.id().to_string() }
    pub fn ticket(&self) -> String { EndpointTicket::new(self.endpoint.addr()).to_string() }
    pub async fn ready(&self) -> Result<(), JsError> {
        n0_future::time::timeout(Duration::from_secs(20), self.endpoint.online()).await.map_err(error)?;
        Ok(())
    }
    pub async fn request(&self, ticket: String, payload: String) -> Result<String, JsError> {
        if payload.len()>MAX_REQUEST { return Err(error("Observation request too large")); }
        let parsed: EndpointTicket = ticket.parse().map_err(error)?;
        let id = parsed.endpoint_addr().id.to_string();
        let cached = self.outgoing.borrow().get(&id).cloned().filter(|c|c.close_reason().is_none());
        let connection = if let Some(c) = cached { c } else {
            let c = n0_future::time::timeout(Duration::from_secs(10), self.endpoint.connect(parsed.endpoint_addr().clone(), ALPN)).await.map_err(error)?.map_err(error)?;
            let mut map = self.outgoing.borrow_mut();
            for (_, old) in map.drain() { old.close(0u8.into(), b"new visit"); }
            map.insert(id.clone(), c.clone()); c
        };
        let result = n0_future::time::timeout(Duration::from_secs(8), async {
            let (mut send, mut recv) = connection.open_bi().await.map_err(error)?;
            send.write_all(payload.as_bytes()).await.map_err(error)?;
            send.finish().map_err(error)?;
            let data = recv.read_to_end(MAX_REPLY).await.map_err(error)?;
            String::from_utf8(data).map_err(error)
        }).await;
        match result { Ok(Ok(v)) => Ok(v), other => { self.outgoing.borrow_mut().remove(&id); connection.close(0u8.into(), b"interrupted"); match other { Ok(Err(e))=>Err(e), _=>Err(error("Town stopped responding")) } } }
    }
    pub fn end_visit(&self) { for (_, c) in self.outgoing.borrow_mut().drain() { c.close(0u8.into(), b"scout recalled"); } }
    pub async fn close(&self) { self.end_visit(); self.endpoint.close().await; }
}
