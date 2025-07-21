
import type React from "react"
import { useState, useRef } from "react"
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Edit, MoreVertical, Upload } from "lucide-react"

export default function PDFManager() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [activeTab, setActiveTab] = useState<"upload" | "existing">("existing")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mock data for existing PDFs
  const existingPdfs = [
    { id: "1", name: "Annual Report 2025", date: "Jul 16, 2025" },
    { id: "2", name: "Financial Analysis Q2", date: "Jul 15, 2025" },
    { id: "3", name: "Market Research Data", date: "Jul 15, 2025" },
    { id: "4", name: "Customer Survey Results", date: "Jul 7, 2025" },
    { id: "5", name: "Product Specifications", date: "Jul 2, 2025" },
    { id: "6", name: "Competitive Analysis", date: "Jul 1, 2025" },
    { id: "7", name: "Strategic Plan 2026", date: "Jun 26, 2025" },
    { id: "8", name: "Budget Forecast", date: "Jun 19, 2025" },
  ]

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      setFiles((prevFiles) => [...prevFiles, ...newFiles])
      // Clear the input so user can select the same files again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  // Navigate to chat page with uploaded files
  const navigateToChat = async () => {
    setIsProcessing(true)

    try {
      // Create FormData to send files to backend
      const formData = new FormData()
      files.forEach((file) => {
        formData.append("files", file)
      })

      // Call your backend API
      const response = await fetch("http://localhost:8000/analyze-pdfs", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to analyze PDFs")
      }

      const analysisData = await response.json()

      // Store analysis data and files in localStorage
      const fileData = files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      }))

      localStorage.setItem("uploadedFiles", JSON.stringify(fileData))
      localStorage.setItem("analysisData", JSON.stringify(analysisData))
      localStorage.setItem("chatSource", "upload")

      // Navigate to chat page
      navigate("/chat")
    } catch (error) {
      console.error("Error analyzing PDFs:", error)
      alert("Failed to analyze PDFs. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Navigate to chat page with existing PDF
  const navigateToChatWithPdf = (pdfId: string) => {
    const selectedPdf = existingPdfs.find((pdf) => pdf.id === pdfId)
    if (selectedPdf) {
      localStorage.setItem("selectedPdf", JSON.stringify(selectedPdf))
      localStorage.setItem("chatSource", "existing")
      router.push("/chat")
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Your PDFs</h3>
              <p className="text-gray-600 mb-4">Making a semantic layer...</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: "70%" }}></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-purple-700">Persona.ai</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">PD</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8">
        <div>
          <h2 className="text-3xl font-light text-gray-400">
            <span className="block text-2xl font-medium text-purple-600 mb-1">Hello, User</span>
            Let's Get Started
          </h2>
          <div className="flex mt-2 space-x-1">
            <div className="h-1 w-12 bg-purple-600 rounded"></div>
            <div className="h-1 w-12 bg-purple-200 rounded"></div>
            <div className="h-1 w-12 bg-purple-100 rounded"></div>
          </div>
        </div>

        {/* Main Container */}
        <div className="mt-8 border border-gray-200 rounded-lg p-8">
          <h2 className="text-3xl font-medium text-gray-700 mb-8">Connect your PDF documents</h2>

          {/* Action Buttons */}
          <div className="flex space-x-4 mb-8">
            <button
              className={`px-6 py-6 rounded-md flex items-center transition-colors ${
                activeTab === "upload"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
              }`}
              onClick={() => setActiveTab("upload")}
            >
              <Upload className="mr-2 h-5 w-5" />
              Upload PDF Documents
            </button>
            <button
              className={`px-6 py-6 rounded-md flex items-center transition-colors ${
                activeTab === "existing"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
              }`}
              onClick={() => setActiveTab("existing")}
            >
              Select from library
            </button>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-700">Recent PDF Documents</h3>
              {activeTab === "existing" && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search"
                    className="pl-10 w-64 bg-gray-50 border border-gray-200 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {activeTab === "upload" ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  multiple
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <FileText className="h-16 w-16 text-gray-400 mb-4" />
                  <h4 className="text-xl font-medium text-gray-700 mb-2">Drag & drop multiple PDFs here</h4>
                  <p className="text-gray-500 mb-6">or</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors"
                    disabled={isProcessing}
                  >
                    Browse Files
                  </button>
                </div>
                {files && files.length > 0 && (
                  <div className="mt-8 text-left">
                    <h5 className="font-medium text-gray-700 mb-2">Selected Files ({files.length})</h5>
                    <ul className="space-y-2">
                      {files.map((file, index) => (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between p-3 bg-purple-50 rounded-lg"
                        >
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-purple-600 mr-3" />
                            <span className="text-gray-700">{file.name}</span>
                            <span className="ml-2 text-sm text-gray-500">
                              ({(file.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 hover:bg-purple-100 rounded-full transition-colors"
                            disabled={isProcessing}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-between items-center">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-purple-700 border border-purple-300 hover:bg-purple-50 py-2 px-4 rounded-md transition-colors"
                        disabled={isProcessing}
                      >
                        Add More PDFs
                      </button>
                      <button
                        onClick={navigateToChat}
                        className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isProcessing}
                      >
                        {isProcessing ? "Processing..." : `Chat with ${files.length} PDF${files.length > 1 ? "s" : ""}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {existingPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => navigateToChatWithPdf(pdf.id)}
                  >
                    <div className="flex items-start">
                      <FileText className="h-6 w-6 text-purple-600 mr-3 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{pdf.name}</h4>
                        <p className="text-sm text-gray-500">{pdf.date}</p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle edit action
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Edit className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle more options
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Help Button */}
      <div className="fixed bottom-6 right-6">
        <button className="rounded-full w-12 h-12 bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center transition-colors">
          <span className="text-lg">?</span>
        </button>
      </div>
    </div>
  )
}
