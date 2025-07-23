"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FileText, Send, FileIcon, ArrowLeft, Hash, User, CheckCircle, XCircle } from "lucide-react"

interface FileData {
  name: string
  size: number
  type: string
  lastModified: number
}

interface PdfData {
  id: string
  name: string
  date: string
}

interface ProcessedFileResult {
  filename: string
  status: string
  summary: string
  headings: string[]
}

interface AnalysisData {
  analysis_id: string
  total_documents_processed: number
  results: ProcessedFileResult[]
}

interface ExtractedSection {
  document: string
  section_title: string
  importance_rank: number
  page_number: number
}

interface SubsectionAnalysis {
  document: string
  refined_text: string
  page_number: number
}

interface BackendChatResponse {
  extracted_sections: ExtractedSection[]
  subsection_analysis: SubsectionAnalysis[]
}

type MessageContent = string | BackendChatResponse

export default function ChatPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: MessageContent }>>([])
  const [input, setInput] = useState("")
  const [persona, setPersona] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarTab, setSidebarTab] = useState("sources")
  const [files, setFiles] = useState<FileData[]>([])
  const [selectedPdf, setSelectedPdf] = useState<PdfData | null>(null)
  const [chatSource, setChatSource] = useState<"upload" | "existing">("upload")
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)

  useEffect(() => {
    const uploadedFiles = localStorage.getItem("uploadedFiles")
    const selectedPdfData = localStorage.getItem("selectedPdf")
    const source = localStorage.getItem("chatSource")
    const analysis = localStorage.getItem("analysisData")

    if (source) {
      setChatSource(source as "upload" | "existing")
    }
    if (uploadedFiles) {
      setFiles(JSON.parse(uploadedFiles))
    }
    if (selectedPdfData) {
      setSelectedPdf(JSON.parse(selectedPdfData))
    }
    if (analysis) {
      setAnalysisData(JSON.parse(analysis))
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handlePersonaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersona(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    const thinkingMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: thinkingMessageId, role: "assistant", content: "AI is thinking..." }])

    try {
      if (!analysisData?.analysis_id) {
        throw new Error("Analysis ID not found. Please upload documents first.")
      }

      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: input,
          persona: persona,
          conversation_id: analysisData.analysis_id,
        }),
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`)
      }

      const backendChatResponse: BackendChatResponse = await response.json()
      setMessages((prev) =>
        prev.map((msg) => (msg.id === thinkingMessageId ? { ...msg, content: backendChatResponse } : msg)),
      )
    } catch (error) {
      console.error("Error sending message to chat backend:", error)
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
      setMessages((prev) =>
        prev.map((msg) => (msg.id === thinkingMessageId ? { ...msg, content: `Error: ${errorMessage}` } : msg)),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  const goBack = () => {
    localStorage.removeItem("uploadedFiles")
    localStorage.removeItem("selectedPdf")
    localStorage.removeItem("chatSource")
    localStorage.removeItem("analysisData")
    navigate("/")
  }

  return (
    <div className="bg-white flex flex-col" style={{ height: '100vh' }}>
      {/* Header - Fixed height */}
      <div className="border-b border-gray-200 p-4 flex justify-between items-center bg-white" style={{ height: '72px' }}>
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4 p-2 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h3 className="font-medium text-lg text-purple-700">Persona.ai</h3>
          <span className="ml-4 text-sm text-gray-500">
            {chatSource === "upload"
              ? `Chatting with uploaded PDF${files.length > 1 ? "s" : ""}`
              : `Chatting with "${selectedPdf?.name}"`}
          </span>
        </div>
        {analysisData && (
          <div className="flex items-center text-sm text-gray-500">
            <Hash className="h-4 w-4 mr-1" />
            <span className="mr-3">Analysis ID: {analysisData.analysis_id}</span>
          </div>
        )}
      </div>

      {/* Main Content - Fixed height calculation */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 72px)' }}>
        {/* Chat Area - Fixed width */}
        <div className="flex flex-col border-r border-gray-200" style={{ width: 'calc(100% - 320px)' }}>
          {/* Messages - Scrollable with fixed height */}
          <div className="overflow-y-auto p-6" style={{ height: 'calc(100% - 132px)' }}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <FileText className="h-16 w-16 text-gray-300 mb-4" />
                <h4 className="text-xl font-medium text-gray-700 mb-2">Ask questions about your PDFs</h4>
                <p className="text-gray-500 max-w-md">
                  The AI will analyze the content and provide answers based on the information in your documents.
                </p>
                {analysisData && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">✓ Semantic layer created successfully!</p>
                    <p className="text-green-600 text-sm mt-1">
                      Processed {analysisData.total_documents_processed} documents
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      message.role === "user"
                        ? "bg-purple-50 border border-purple-100"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <p className="text-sm font-medium mb-1">{message.role === "user" ? "You" : "AI Assistant"}</p>
                    {typeof message.content === "string" ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="space-y-4">
                        {message.content.extracted_sections.length > 0 && (
                          <div>
                            <h5 className="text-md font-semibold text-gray-800 mb-2">Extracted Sections:</h5>
                            <div className="space-y-2">
                              {message.content.extracted_sections.map((section, secIndex) => (
                                <div key={secIndex} className="p-3 bg-white border border-gray-200 rounded-md">
                                  <p className="text-sm font-medium text-gray-700">
                                    Document: <span className="font-normal">{section.document}</span>
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Section: <span className="font-normal">{section.section_title}</span>
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Page: <span className="font-normal">{section.page_number}</span>
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Importance: <span className="font-normal">{section.importance_rank}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {message.content.subsection_analysis.length > 0 && (
                          <div>
                            <h5 className="text-md font-semibold text-gray-800 mb-2">Subsection Analysis:</h5>
                            <div className="space-y-2">
                              {message.content.subsection_analysis.map((subsection, subIndex) => (
                                <div key={subIndex} className="p-3 bg-white border border-gray-200 rounded-md">
                                  <p className="text-sm font-medium text-gray-700">
                                    Document: <span className="font-normal">{subsection.document}</span>
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Page: <span className="font-normal">{subsection.page_number}</span>
                                  </p>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                    Text: <span className="font-normal">{subsection.refined_text}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.content === "AI is thinking..." && (
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-sm font-medium mb-1">AI Assistant</p>
                    <div className="flex space-x-2 items-center">
                      <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"></div>
                      <div
                        className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area - Fixed height */}
          <div className="border-t border-gray-200 p-4 bg-white" style={{ height: '132px' }}>
            <div className="mb-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={persona}
                  onChange={handlePersonaChange}
                  placeholder="Set AI persona (e.g., financial analyst, teacher, researcher)..."
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50"
                />
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Enter a prompt, or press '/' for multiple prompts..."
                className="flex-1 border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-md transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar - Fixed width */}
        <div className="w-80 flex flex-col bg-white">
          {/* Sidebar Header - Fixed height */}
          <div className="p-4 border-b border-gray-200 flex items-center" style={{ height: '64px' }}>
            <div className="flex items-center">
              <FileIcon className="h-5 w-5 text-purple-600 mr-2" />
              <h3 className="font-medium">PDF Workspace</h3>
            </div>
          </div>

          {/* Sidebar Content - Scrollable with fixed height */}
          <div className="overflow-y-auto" style={{ height: 'calc(100vh - 72px - 64px)' }}>
            {sidebarTab === "sources" && (
              <div className="p-4">
                {analysisData ? (
                  <>
                    <div className="text-sm text-gray-500 mb-4">
                      Analysis Results ({analysisData.total_documents_processed} documents)
                    </div>
                    <div className="space-y-4">
                      {analysisData.results.map((result, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {result.status.includes("Successfully") ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 mr-2" />
                              )}
                              <span className="font-medium text-sm text-gray-800">{result.filename}</span>
                            </div>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <h4 className="text-xs font-medium text-blue-800 mb-1">SUMMARY</h4>
                            <p className="text-sm text-blue-700">{result.summary}</p>
                          </div>
                          {result.headings.length > 0 && (
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                              <h4 className="text-xs font-medium text-gray-800 mb-2">
                                EXTRACTED HEADINGS ({result.headings.length})
                              </h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {result.headings.map((heading, headingIndex) => (
                                  <div
                                    key={headingIndex}
                                    className="text-xs text-gray-600 py-1 px-2 bg-white rounded border"
                                  >
                                    {heading}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No analysis data available</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === "documents" && (
              <div className="p-4">
                <div className="text-sm text-gray-500 mb-4">
                  Active Documents ({chatSource === "upload" ? files.length : selectedPdf ? 1 : 0})
                </div>
                {chatSource === "upload" ? (
                  files.length > 0 ? (
                    <ul className="space-y-2">
                      {files.map((file, index) => (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <FileText className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{file.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No documents found</p>
                    </div>
                  )
                ) : selectedPdf ? (
                  <div className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <FileText className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" />
                    <div>
                      <span className="text-sm text-gray-700 block">{selectedPdf.name}</span>
                      <span className="text-xs text-gray-500">{selectedPdf.date}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No documents found</p>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === "prompts" && (
              <div className="p-4">
                <div className="text-sm text-gray-500 mb-4">Suggested Prompts</div>
                <div className="space-y-2">
                  {[
                    "Summarize the key points from all documents",
                    "Compare and contrast the main arguments",
                    "Extract all numerical data and statistics",
                    "Find contradictions between documents",
                    "What are the main topics covered?",
                    "List all the important dates mentioned",
                  ].map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="w-full text-left py-2 px-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}