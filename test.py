from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List, Dict, Any, Optional
import asyncio
import tempfile
import os
import re
import logging
import json
from pydantic import BaseModel, Field
import uuid
from fastapi.middleware.cors import CORSMiddleware
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.prompts import ChatPromptTemplate
from langchain_community.vectorstores import FAISS
from langchain_core.output_parsers import JsonOutputParser
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Intelligent RAG API",
    description="An advanced RAG system that filters and re-ranks results for higher relevance.",
    version="5.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class ExtractedSection(BaseModel):
    document: str
    section_title: str
    importance_rank: int
    page_number: int

class SubsectionAnalysis(BaseModel):
    document: str
    refined_text: str
    page_number: int

class StructuredChatResponse(BaseModel):
    extracted_sections: List[ExtractedSection]
    subsection_analysis: List[SubsectionAnalysis]

class PDFAnalysisResult(BaseModel):
    filename: str
    status: str
    extracted_headings_count: int

class AnalysisResponse(BaseModel):
    analysis_id: str
    total_documents_processed: int
    results: List[PDFAnalysisResult]

class ChatRequest(BaseModel):
    query: str
    persona: Optional[str] = "An expert document analyst."

# Internal model for processing chunks
class ProcessedChunk(BaseModel):
    section_title: str
    refined_text: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    document: str
    page_number: int

# --- In-Memory Storage & Configuration ---
pdf_data_stores = {}
STOP_TITLES = {"introduction", "conclusion", "summary", "abstract", "table of contents", "preface", "references", "bibliography"}

# --- Language Model and Embeddings ---
llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.0, model_kwargs={"response_format": {"type": "json_object"}})
embeddings = OpenAIEmbeddings()

# --- Core Logic: PDFAnalyzer ---
class PDFAnalyzer:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=200)

    def extract_headings(self, full_text: str) -> List[str]:
        headings = set()
        for line in full_text.split('\n'):
            trimmed_line = line.strip()
            if 3 < len(trimmed_line) < 100 and (trimmed_line.isupper() or trimmed_line.istitle()):
                headings.add(trimmed_line)
        return list(headings)

    async def process_pdf(self, file_path: str, filename: str) -> Optional[Dict[str, Any]]:
        try:
            loader = PyPDFLoader(file_path)
            documents = await asyncio.to_thread(loader.load)
            if not documents: return None

            full_text = "\n".join([doc.page_content for doc in documents])
            headings = self.extract_headings(full_text)
            for doc in documents: doc.metadata["source"] = filename
            
            chunks = self.text_splitter.split_documents(documents)
            vector_store = await asyncio.to_thread(FAISS.from_documents, chunks, embeddings)
            return {"vector_store": vector_store, "headings": headings}
        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {e}")
            return None

# --- FastAPI Endpoints ---
analyzer = PDFAnalyzer()

@app.post("/analyze-pdfs/", response_model=AnalysisResponse)
async def analyze_pdfs_endpoint(files: List[UploadFile] = File(...)):
    # ... (This endpoint remains the same as version 4.0.0)
    if not files:
        raise HTTPException(status_code=400, detail="No PDF files provided.")

    analysis_id = str(uuid.uuid4())
    processed_files = []

    with tempfile.TemporaryDirectory() as temp_dir:
        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                continue

            temp_file_path = os.path.join(temp_dir, file.filename)
            with open(temp_file_path, "wb") as f:
                f.write(await file.read())
            
            processed_data = await analyzer.process_pdf(temp_file_path, file.filename)
            if processed_data:
                pdf_data_stores[file.filename] = processed_data
                processed_files.append(PDFAnalysisResult(
                    filename=file.filename,
                    status="Successfully processed and indexed.",
                    extracted_headings_count=len(processed_data["headings"])
                ))

    if not processed_files:
        raise HTTPException(status_code=500, detail="Could not process any of the provided PDF files.")

    return AnalysisResponse(
        analysis_id=analysis_id,
        total_documents_processed=len(processed_files),
        results=processed_files,
    )


async def process_chunk(chunk: Document, query: str, persona: str, available_headings: List[str]) -> Optional[ProcessedChunk]:
    prompt = ChatPromptTemplate.from_template("""
    You are a '{persona}'. Your task is to analyze a text chunk for its relevance to a user's query.
    
    Perform the following actions:
    1.  From the "AVAILABLE HEADINGS" list, choose the heading that is the most accurate parent title for the "DOCUMENT CHUNK".
    2.  Carefully read the "DOCUMENT CHUNK" and determine how directly it answers the "USER QUERY".
    3.  Assign a "relevance_score" from 0.0 (not relevant) to 1.0 (highly relevant). Give lower scores to generic sections like introductions or summaries unless they contain specific, actionable answers.
    4.  Extract and refine the text from the chunk that directly answers the query.
    
    Respond ONLY with a valid JSON object in this exact format:
    {{
        "section_title": "The best matching heading from the provided list",
        "refined_text": "The portion of the text that directly relates to the user's query",
        "relevance_score": <A float between 0.0 and 1.0>
    }}

    AVAILABLE HEADINGS: {headings}
    USER QUERY: "{query}"
    DOCUMENT CHUNK (from page {page_number}): --- {context} ---
    """)
    
    try:
        chain = prompt | llm | JsonOutputParser(pydantic_object=ProcessedChunk)
        result_dict = await chain.ainvoke({
            "persona": persona,
            "query": query,
            "context": chunk.page_content,
            "page_number": chunk.metadata.get("page", "N/A"),
            "headings": "\\n- ".join(available_headings)
        })
        # Add metadata not included by the LLM
        result_dict['document'] = chunk.metadata.get('source', 'Unknown')
        result_dict['page_number'] = chunk.metadata.get('page', 0) + 1
        return ProcessedChunk(**result_dict)
    except Exception as e:
        logger.error(f"Error processing chunk for doc {chunk.metadata.get('source')}: {e}")
        return None


@app.post("/chat/", response_model=StructuredChatResponse)
async def chat_with_pdfs(request: ChatRequest):
    if not pdf_data_stores:
        raise HTTPException(status_code=400, detail="No PDFs analyzed. Upload documents via /analyze-pdfs/ first.")

    # 1. Retrieve relevant documents from all stores
    retrieval_tasks = []
    for filename, data in pdf_data_stores.items():
        retriever = data["vector_store"].as_retriever(search_kwargs={'k': 5})
        retrieval_tasks.append(asyncio.to_thread(retriever.get_relevant_documents, request.query))
    
    list_of_docs_lists = await asyncio.gather(*retrieval_tasks)
    all_relevant_docs = [doc for sublist in list_of_docs_lists for doc in sublist]
    
    if not all_relevant_docs:
        raise HTTPException(status_code=404, detail="Could not find any relevant information for your query.")

    unique_docs = {doc.page_content: doc for doc in all_relevant_docs}.values()

    # 2. Process each unique document chunk concurrently for scoring and extraction
    processing_tasks = []
    for doc in unique_docs:
        source_file = doc.metadata.get("source")
        if source_file in pdf_data_stores:
            headings = pdf_data_stores[source_file]["headings"]
            processing_tasks.append(process_chunk(doc, request.query, request.persona, headings))
    
    processed_results = await asyncio.gather(*processing_tasks)

    # 3. Filter and re-rank the results
    valid_results = [res for res in processed_results if res is not None]
    
    # Filter out common "junk" titles and low-relevance scores
    filtered_results = [
        res for res in valid_results 
        if res.section_title.lower().strip() not in STOP_TITLES and res.relevance_score > 0.4
    ]
    
    # Sort by the new relevance score
    sorted_results = sorted(filtered_results, key=lambda x: x.relevance_score, reverse=True)

    if not sorted_results:
        raise HTTPException(status_code=404, detail="Found some initial matches, but none were relevant enough after filtering.")

    # 4. Assemble the final structured response from the top results
    extracted_sections, subsection_analysis = [], []
    for rank, result in enumerate(sorted_results[:7], 1): # Take top 7
        extracted_sections.append(ExtractedSection(
            document=result.document,
            section_title=result.section_title,
            importance_rank=rank,
            page_number=result.page_number
        ))
        subsection_analysis.append(SubsectionAnalysis(
            document=result.document,
            refined_text=result.refined_text,
            page_number=result.page_number
        ))

    return StructuredChatResponse(
        extracted_sections=extracted_sections,
        subsection_analysis=subsection_analysis,
    )


@app.get("/")
def root():
    return {"message": "Welcome to the Intelligent RAG API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)